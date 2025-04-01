/**
 * Represents a job with a link and description.
 * 
 * @property {string} link - The URL of the job listing.
 * @property {string} desc - The description of the job.
 */
export default class Job {
	public link: string;
	public desc: string;

	constructor(link: string, desc: string) {
		this.link = link;
		this.desc = desc;
	}
}
