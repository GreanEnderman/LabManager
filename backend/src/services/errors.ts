export class EntityNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found.`)
    this.name = 'EntityNotFoundError'
  }
}

export class ValidationError extends Error {
  code: string

  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
    this.code = 'validation_error'
  }
}

export class PasswordPolicyError extends ValidationError {
  constructor(message: string) {
    super(message)
    this.name = 'PasswordPolicyError'
    this.code = 'password_policy_violation'
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication is required.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class TooManyRequestsError extends Error {
  code: string

  constructor(message = 'Too many attempts. Please try again later.') {
    super(message)
    this.name = 'TooManyRequestsError'
    this.code = 'too_many_attempts'
  }
}
