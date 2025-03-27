export const appMethodPrompt = `Here is a job description. Does it indicate any specific
application method other than clicking the apply button? If so, describe the method in as few words
as possible. If the method includes contact information or a link, include the contact information
or link in your response. Your response should be a single word or phrase, or "none" if no
specific method is	indicated.\n\n\n`;

export const jobComparePrompt = `You are a recruiter for a company. A job applicant has submitted their resume to your talent pool. You must now evaluate which job opening is the best fit for this applicant. The job openings are listed below in the following format:

\`\`\`
https://example.com/foo
-----
Job Title at This Company
...more description...
\`\`\`

Your answer should just be the plaintext link that is above the most suitable job description. Do not use Markdown, HTML, or any other form of formatting, and do not add any commentary.`
