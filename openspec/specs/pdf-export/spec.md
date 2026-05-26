## ADDED Requirements

### Requirement: Export report to PDF
The system SHALL export generated reports to PDF format with proper layout and formatting.

#### Scenario: Export report to PDF successfully
- **WHEN** user requests PDF export of a report
- **THEN** system returns PDF file with report content properly formatted

#### Scenario: Export empty report to PDF
- **WHEN** user requests PDF export of empty report
- **THEN** system returns PDF with empty state message

### Requirement: Support Chinese font rendering
The system SHALL render Chinese characters correctly in PDF exports using bundled fonts.

#### Scenario: PDF contains Chinese text
- **WHEN** report contains Chinese characters
- **THEN** PDF export renders all Chinese characters correctly without missing glyphs

#### Scenario: PDF uses consistent font
- **WHEN** system generates PDF
- **THEN** PDF uses configured Chinese font (Noto Sans CJK or equivalent) throughout

### Requirement: Maintain PDF layout consistency
The system SHALL maintain consistent layout, margins, and styling across all PDF exports.

#### Scenario: PDF has standard layout
- **WHEN** system generates any PDF
- **THEN** PDF has consistent margins, headers, footers, and page structure

#### Scenario: PDF handles page breaks
- **WHEN** report content exceeds one page
- **THEN** PDF properly breaks content across pages without cutting off text

### Requirement: Include audit metadata in PDF
The system SHALL include audit metadata (operator, timestamp, runId) in PDF exports.

#### Scenario: PDF includes metadata
- **WHEN** system exports report to PDF
- **THEN** PDF includes operator ID, generation timestamp, and runId in header or footer

### Requirement: Handle PDF generation errors
The system SHALL handle PDF generation errors gracefully and return meaningful error messages.

#### Scenario: PDF generation fails due to missing font
- **WHEN** required font is not available
- **THEN** system logs error and returns error message indicating font issue

#### Scenario: PDF generation fails due to invalid content
- **WHEN** report content cannot be rendered to PDF
- **THEN** system logs error and returns error message indicating content issue

### Requirement: Support PDF export API
The system SHALL provide stable API endpoint for PDF export requests.

#### Scenario: Call PDF export API with valid report data
- **WHEN** client calls PDF export API with valid report data
- **THEN** system returns PDF file with correct content-type header

#### Scenario: Call PDF export API with invalid data
- **WHEN** client calls PDF export API with invalid or missing data
- **THEN** system returns 400 error with validation message

### Requirement: PDF deployment environment compatibility
The system SHALL ensure PDF generation works in deployment environment with bundled fonts and dependencies.

#### Scenario: PDF generation in Docker container
- **WHEN** system runs in Docker container
- **THEN** PDF generation succeeds with bundled fonts and dependencies

#### Scenario: PDF generation without system fonts
- **WHEN** system runs in environment without system fonts
- **THEN** PDF generation succeeds using bundled fonts only
