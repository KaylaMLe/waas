/**
 * Represents a job with a link and description.
 *
 * @property {string} position - The job title and company name in format "[position] at [company]".
 * @property {string} link - The URL of the job listing.
 * @property {string} desc - The description of the job.
 * @property {string} appMethod - The application method for this job (e.g., "Apply online", "Email", "none").
 */
export default class Job {
	public link: string;
	public desc: string;
	public position: string;
	public appMethod: string | null = null;

	constructor(position: string, link: string, desc: string) {
		this.link = link;
		this.desc = desc;
		this.position = position;
	}
}
