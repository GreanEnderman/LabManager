export interface IdGenerator {
  next(prefix: string): string
}

export function createIncrementalIdGenerator(seed = 0): IdGenerator {
  let current = seed

  return {
    next(prefix: string) {
      current += 1
      return `${prefix}_${current}`
    },
  }
}
