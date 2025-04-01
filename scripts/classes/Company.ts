import Job from './Job.js';

/**
 * Represents a company
 * 
 * @property {boolean} applied - whether this company has already been applied to
 * @property {Job[]} jobs - the list of jobs at this company
 */
export default class Company {
	public applied: boolean;
	public jobs: Job[] = [];

	constructor(applied: boolean) {
		this.applied = applied;
	}
}
