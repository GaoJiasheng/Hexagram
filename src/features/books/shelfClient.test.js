import { describe, it, expect } from 'vitest'
import { SHELF_ACCEPT } from './shelfClient.js'

describe('SHELF_ACCEPT', () => {
  it('网页(非原生)限 .deskbook / zip', () => {
    expect(SHELF_ACCEPT).toBe('.deskbook,application/zip')
  })
})
