# 福利彩票爬虫 - Puppeteer 解决方案

由于网站使用了严格的反爬虫机制（403 Forbidden），建议使用 Puppeteer 来执行 JavaScript 并获取动态加载的数据。

## 安装 Puppeteer

```bash
npm install puppeteer
# 或
npm install puppeteer-core  # 如果已有 Chrome
```

## 使用 Puppeteer 的爬虫实现

由于当前网站可能通过 JavaScript 动态加载数据，使用 Puppeteer 可以：

1. 执行页面中的 JavaScript
2. 等待数据加载完成
3. 获取完整的 DOM 内容
4. 绕过简单的反爬虫检测

## 实现建议

如果需要实现 Puppeteer 版本，可以：

1. 创建一个新的 `lottery-crawler-puppeteer.ts` 文件
2. 使用 Puppeteer 打开页面
3. 等待数据加载（使用 `waitForSelector` 或 `waitForTimeout`）
4. 提取页面内容
5. 解析数据

## 临时解决方案

在实现 Puppeteer 版本之前，可以：

1. **手动查看页面结构**：
   - 在浏览器中打开 `https://www.cwl.gov.cn/ygkj/wqkjgg/`
   - 打开开发者工具（F12）
   - 查看 Network 标签，看是否有 AJAX 请求
   - 查看 Elements 标签，查看实际的 HTML 结构

2. **查找 API 接口**：
   - 如果找到 JSON 格式的 API 接口，可以直接调用
   - 这比解析 HTML 更可靠

3. **使用浏览器扩展**：
   - 可以使用浏览器扩展来导出数据
   - 然后手动导入到数据库

## 注意事项

⚠️ **重要提醒**：
- 使用 Puppeteer 会增加资源消耗（内存、CPU）
- 需要安装 Chromium（约 170MB）
- 爬取速度会较慢
- 仍然需要遵守网站的 robots.txt 和服务条款

