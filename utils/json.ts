import { parsePartialJson } from '@ai-sdk/ui-utils'
import { z } from 'zod'
import { getConfig } from '../server/utils/server-config'
import { logger } from './logger'

export type DeepPartial<T> = T extends object
  ? T extends Array<any>
    ? T
    : { [P in keyof T]?: DeepPartial<T[P]> }
  : T

export function removeJsonMarkdown(text: string) {
  if (text.startsWith('```json')) {
    text = text.slice(7)
  } else if (text.startsWith('json')) {
    text = text.slice(4)
  } else if (text.startsWith('```')) {
    text = text.slice(3)
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3)
  }
  return text
}

/**
 * 解析流式的 JSON 数据
 * @param textStream 字符串流
 * @param _schema zod schema 用于类型验证
 * @param isValid 自定义验证函数，用于判断解析出的 JSON 是否有效
 * @returns 异步生成器，yield 解析后的数据
 */
export async function* parseStreamingJson<T extends z.ZodType>(
  textStream: AsyncIterable<string>,
  _schema: T,
  isValid: (value: DeepPartial<z.infer<T>>) => boolean,
): AsyncGenerator<DeepPartial<z.infer<T>>> {
  const config = getConfig()
  let rawText = ''
  let isParseSuccessful = false

    if (config.isDev) {
      logger.debug('[LLM Stream] Starting JSON stream parsing');
    }

  for await (const chunk of textStream) {
    if (config.isDev) {
      logger.debug(`[LLM Stream] Received chunk: ${chunk}`);
    }
    rawText = removeJsonMarkdown(rawText + chunk)
    const parsed = parsePartialJson(rawText)

    isParseSuccessful =
      parsed.state === 'repaired-parse' || parsed.state === 'successful-parse'
    if (isParseSuccessful && isValid(parsed.value as any)) {
      if (config.isDev) {
        logger.debug(`[LLM Stream] Valid JSON parsed: ${JSON.stringify(parsed.value, null, 2)}`);
      }
      yield parsed.value as DeepPartial<z.infer<T>>
    } else {
      if (config.isDev) {
        logger.debug(`[LLM Stream] Invalid or incomplete JSON: ${JSON.stringify({
          state: parsed.state,
          value: parsed.value
        }, null, 2)}`);
      }
      console.dir(parsed, { depth: null, colors: true })
    }
  }

  if (config.isDev) {
    logger.debug(`[LLM Stream] Stream parsing complete, success: ${isParseSuccessful}`);
  }
  return { isSuccessful: isParseSuccessful }
}
