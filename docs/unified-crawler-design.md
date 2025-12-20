# 统一搜索与自定义爬虫体系设计（V1）

最后更新：2025-11-27

## 1. 目标
- 统一“输入关键词 → 聚合发现 → 一键订阅站点 → 持续爬取”的全链路体验。
- 降低新增站点成本，支持自动/半自动生成 `configurable-html` 配置。
- 增强任务编排、错误恢复与可观测性。

## 2. 总体架构

```
           +-------------------+
           |  Keyword Search   |
           |  (User Input)     |
           +---------+---------+
                     |
                     v
   +-----------------+-----------------+
   |  SearchOrchestrator Service       |
   |  - 内置平台调用 (crawlWithOptions)|
   |  - SERP/新闻 API (Bing/SerpAPI)   |
   |  - 探索爬虫 (浅层 BFS)           |
   +-----------+-----------+-----------+
               |聚合结果 (UnifiedSearchResult)
               v
   +-----------------+-----------------+
   |  Search UI / API                  |
   |  - 展示卡片                       |
   |  - 一键“持续跟踪”                 |
   +-----------+-----------+-----------+
               |站点配置
               v
   +-----------------+-----------------+
   | Config Builder Service             |
   | - ConfigInference (自动推断)      |
   | - 手动微调 (CustomWebsitesConfig) |
   | - 验证/测试 API                   |
   +-----------+-----------+-----------+
               |落库 customWebsites / platforms
               v
   +-----------------+-----------------+
   |  Crawl Scheduler & Workers        |
   |  - 多队列 (search/platform/custom)|
   |  - proxyFallback + Health Monitor |
   |  - Content Validation             |
   +-----------------+-----------------+
```

## 3. 关键模块设计

### 3.1 SearchOrchestrator
- 输入：`keywords: string[], options { includePlatforms?: string[] }`
- 流程：
  1. 并行触发内置平台 `crawlWithOptions({ mode: 'search' })`。
  2. 调用第三方搜索 API（Bing News、SerpAPI）获取站点候选。
  3. 可选：运行 lightweight HTML 搜索爬虫（例如现有 `web-search` 平台）补充结果。
  4. 输出统一结构：
     ```ts
     interface UnifiedSearchResult {
       title: string
       url: string
       snippet?: string
       source: 'weibo' | 'bing-news' | 'serp' | 'custom'
       discoveredAt: Date
       confidence: number
       platformId?: string
       siteFingerprint?: string // domain + hash
     }
     ```
- 数据落地：保存最近一次搜索快照（`search_results` 表，便于回溯/推荐）。

### 3.2 Config Builder
- 提供多个入口：
  - 搜索卡片「持续跟踪」→ 生成 `SiteSubscriptionRequest`。
  - 在 `KeywordGroup` 页面新增「候选站点」面板。
- 组成：
  1. **ConfigInferenceService**：根据示例列表页 HTML，推断 `itemSelector`、`title/url/publishedAt` 选择器。第一版可基于启发式（找 `ul/li`、`article` 等），后续可引入 DOM ML。
  2. **ValidationRunner**：复用 `ConfigurableHtmlCrawler` 的 content checker，执行一次试抓并返回样例。
  3. **ConfigRepository**：把确定的配置写入 `keyword_groups.customWebsites`，同时在 `platforms` 表注册 `type='configurable-html'`。

### 3.3 执行编排
- 队列划分：
  - `search` 队列：统一搜索任务，允许较高延迟。
  - `platform` 队列：内置平台定时任务。
  - `custom` 队列：用户订阅站点。
- Worker 功能：
  - proxyFallback（已在 `fetch-helper` 中支持）+ 多出口 IP。
  - 失败重试策略：首次失败记录，连续 N 次失败自动触发“重新验证”流程。
  - 任务状态写入 `crawl_tasks`，UI 通过 `CrawlProgressDialog` 展示。

### 3.4 监控与治理
- 新增指标：
  - 搜索任务成功率 / 时延
  - ConfigInference success rate
  - 自定义站点内容校验通过率
- Terraform/脚本新增 `cleanup:crawl-tasks`、`check:db-columns` 已完成。

## 4. 数据库设计

### 4.1 新表 / 字段
1. `search_results`（记录统一搜索快照）
   - `id` (uuid) / `keywords` (text[]) / `source` / `title` / `url` / `snippet` / `confidence` / `created_at`
2. `site_candidates`（候选站点）
   - `id` / `domain` / `status` ('new'|'configured'|'rejected') / `lastDiscoveredAt` / `configJson`
3. `keyword_groups`
   - `customWebsites` 已有；增加 `discoveredWebsites` (jsonb) 记录候选列表。

详见第 6 章 SQL。

## 5. API 方案

| Endpoint | 描述 |
|----------|------|
| `POST /api/search/unified` | 输入关键词，返回 `UnifiedSearchResult[]` |
| `POST /api/search/site/subscribe` | 根据 search result 快速生成配置并验证 |
| `POST /api/search/site/test` | 手动测试配置 |
| `GET /api/search/candidates` | 查询某关键词组的候选站点列表 |

## 6. 数据库 SQL

### 6.1 开发环境（PostgreSQL，Windows）
```sql
-- 新表：search_results
CREATE TABLE IF NOT EXISTS search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords TEXT[] NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  confidence NUMERIC(5,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 新表：site_candidates
CREATE TABLE IF NOT EXISTS site_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  keyword_group_id TEXT,
  last_discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  config_json JSONB,
  stats_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- keyword_groups 新列
ALTER TABLE keyword_groups
  ADD COLUMN IF NOT EXISTS discovered_websites JSONB;
```

### 6.2 生产环境（Neon / Linux）
```sql
-- search_results
CREATE TABLE IF NOT EXISTS public.search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords TEXT[] NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  confidence NUMERIC(5,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- site_candidates
CREATE TABLE IF NOT EXISTS public.site_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  keyword_group_id TEXT,
  last_discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  config_json JSONB,
  stats_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.keyword_groups
  ADD COLUMN IF NOT EXISTS discovered_websites JSONB;
```

> 注：若生产环境 `gen_random_uuid()` 不可用，需要预先 `CREATE EXTENSION IF NOT EXISTS pgcrypto;`

## 7. 实施计划

1. **阶段 A – 搜索统一化**
   - 实现 `SearchOrchestrator` 服务与 `/api/search/unified`。
   - 保存 `search_results`，展示基础 UI。
2. **阶段 B – Config Builder**
   - 新增订阅 API、ConfigInference、验证流程。
   - 更新 `CustomWebsitesConfig` 支持“来自搜索”预填。
3. **阶段 C – 候选站点可视化与配置导入（当前优先）**
   - 关键词组详情页增加“候选站点”列表，展示 `discovered_websites` / `site_candidates`。
   - 支持一键订阅、忽略、标记无效等状态操作。
   - 自定义网站表单中提供“从候选导入/自动推断”入口，直接预填配置。
4. **阶段 D – 执行编排增强**
   - 队列拆分、任务监控、统一搜索任务日志。
5. **阶段 E – 自愈与治理**
   - 再学习/提醒机制、指标上报、文档完善。

---

