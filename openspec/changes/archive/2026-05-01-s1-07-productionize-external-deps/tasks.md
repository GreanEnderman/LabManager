## 1. PDF Font Configuration

- [x] 1.1 Add PDF_FONT_PATH environment variable support
- [x] 1.2 Implement platform-specific system font directory fallback
- [x] 1.3 Add font availability validation with clear error messages
- [x] 1.4 Remove hardcoded Windows font paths from PDF generation code

## 2. LLM Configuration

- [x] 2.1 Add LLM_API_KEY, LLM_ENDPOINT, LLM_MODEL environment variables
- [x] 2.2 Implement startup validation for required LLM configuration
- [x] 2.3 Update LLM integration code to use environment-based config
- [x] 2.4 Add clear error messages for missing LLM configuration

## 3. SMTP Configuration

- [x] 3.1 Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM environment variables
- [x] 3.2 Implement development mode fallback (log to file)
- [x] 3.3 Update email service to use environment-based config
- [x] 3.4 Add production mode validation for SMTP configuration

## 4. Startup Validation

- [x] 4.1 Create configuration validation module
- [x] 4.2 Implement environment-specific validation rules (dev vs production)
- [x] 4.3 Add startup checks for all required external dependencies
- [x] 4.4 Ensure fail-fast behavior with clear error reporting

## 5. Documentation

- [x] 5.1 Document all new environment variables in deployment guide
- [x] 5.2 Add platform-specific font installation instructions
- [x] 5.3 Create configuration validation script for deployment verification
- [x] 5.4 Update README with environment setup requirements
