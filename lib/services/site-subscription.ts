import type { PrismaClient, Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'

export interface SiteSubscriptionInput {
  keywordGroupId?: string
  domain?: string
  title?: string
  url: string
  snippet?: string
  metadata?: Record<string, any>
  configDraft?: Prisma.JsonValue
}

export class SiteSubscriptionService {
  constructor(private prismaClient: PrismaClient = prisma) {}

  async subscribeSite(input: SiteSubscriptionInput) {
    const domain = input.domain || this.extractDomain(input.url)
    if (!domain) {
      throw new Error('无法解析域名')
    }

    return this.prismaClient.$transaction(async tx => {
      const candidate = await tx.siteCandidate.create({
        data: {
          domain,
          status: 'new',
          keywordGroupId: input.keywordGroupId,
          ...(input.configDraft && { configJson: input.configDraft as Prisma.InputJsonValue }),
          statsJson: {
            title: input.title,
            url: input.url,
            snippet: input.snippet,
            metadata: input.metadata,
          },
        },
      })

      if (input.keywordGroupId) {
        const group = await tx.keywordGroup.findUnique({
          where: { id: input.keywordGroupId },
          select: { discoveredWebsites: true },
        })

        if (group) {
          const existing = (group.discoveredWebsites as any[]) ?? []
          const normalized = existing.filter(
            item => item && item.domain !== domain && item.candidateId !== candidate.id
          )
          normalized.unshift({
            candidateId: candidate.id,
            domain,
            title: input.title,
            url: input.url,
            snippet: input.snippet,
            createdAt: new Date().toISOString(),
          })
          await tx.keywordGroup.update({
            where: { id: input.keywordGroupId },
            data: {
              discoveredWebsites: normalized as Prisma.InputJsonValue,
            },
          })
        }
      }

      return candidate
    })
  }

  private extractDomain(rawUrl: string) {
    try {
      const parsed = new URL(rawUrl)
      return parsed.hostname
    } catch {
      return null
    }
  }
}

