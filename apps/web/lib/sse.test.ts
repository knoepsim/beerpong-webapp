import { describe, expect, it } from 'vitest'
import { readEventStream, type ServerEvent } from './sse'

const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })

const read = async (chunks: string[]) => {
  const events: ServerEvent[] = []
  for await (const event of readEventStream(stream(chunks))) events.push(event)
  return events
}

describe('readEventStream', () => {
  it('reads name, id and data of an event', async () => {
    expect(await read(['event: revision\nid: 7\ndata: {"revision":7}\n\n'])).toEqual([
      { event: 'revision', id: '7', data: '{"revision":7}' },
    ])
  })

  it('skips comments and the retry hint, they are no events', async () => {
    expect(await read(['retry: 3000\n\n', ': ping\n\n', 'event: a\ndata: 1\n\n'])).toEqual([
      { event: 'a', id: null, data: '1' },
    ])
  })

  it('puts together an event that arrives in pieces, also in the middle of a word or a line break', async () => {
    const events = await read(['event: rev', 'ision\ndata: {"a"', ':1}\r', '\n\r', '\nevent: b\ndata: 2\n', '\n'])
    expect(events.map((e) => [e.event, e.data])).toEqual([
      ['revision', '{"a":1}'],
      ['b', '2'],
    ])
  })

  it('joins several data lines and defaults the name to "message"', async () => {
    expect(await read(['data: eins\ndata: zwei\n\n'])).toEqual([{ event: 'message', id: null, data: 'eins\nzwei' }])
  })

  it('does not carry the name or id of one event into the next', async () => {
    const events = await read(['event: a\nid: 1\ndata: x\n\n', 'data: y\n\n'])
    expect(events[1]).toEqual({ event: 'message', id: null, data: 'y' })
  })

  it('drops an event that was not finished when the stream ended', async () => {
    expect(await read(['event: a\ndata: 1\n\n', 'event: b\ndata: 2'])).toHaveLength(1)
  })

  it('reads umlauts that are split between two chunks', async () => {
    const bytes = new TextEncoder().encode('data: Ärger\n\n')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7)) // in the middle of the Ä
        controller.enqueue(bytes.slice(7))
        controller.close()
      },
    })
    const events: ServerEvent[] = []
    for await (const event of readEventStream(body)) events.push(event)
    expect(events[0].data).toBe('Ärger')
  })
})
