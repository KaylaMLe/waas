export default class Job {
	public link: string;
	public appMethod: string;
	public desc: string;

	constructor(link: string, appMethod: string, desc: string) {
		this.link = link;
		this.appMethod = appMethod;
		this.desc = desc;
	}
}
