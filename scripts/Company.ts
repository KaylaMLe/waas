import Job from './Job';

/**
 * Represents a company
 * 
 * @property {boolean} applied - whether this company has already been applied to
 * @property {Job[]} jobs - the list of jobs at this company
 */
export default class Company {
	/**
	 * @param applied - whether this company has already been applied to
	 */
	public applied: boolean;
	public jobs: Job[] = [];

	constructor(applied: boolean) {
		this.applied = applied;
	}
}
