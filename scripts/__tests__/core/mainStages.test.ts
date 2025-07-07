import { jest } from '@jest/globals';
import { loggingIn, searchForJobs, handleMessageApprovalAndApplication } from '../../core/mainStages';

// Mock the split modules
jest.mock('../../core/login', () => ({
	loggingIn: jest.fn(),
}));

jest.mock('../../core/jobSearch', () => ({
	searchForJobs: jest.fn(),
}));

jest.mock('../../core/application', () => ({
	handleMessageApprovalAndApplication: jest.fn(),
}));

describe('mainStages', () => {
	it('should re-export loggingIn function', () => {
		expect(loggingIn).toBeDefined();
	});

	it('should re-export searchForJobs function', () => {
		expect(searchForJobs).toBeDefined();
	});

	it('should re-export handleMessageApprovalAndApplication function', () => {
		expect(handleMessageApprovalAndApplication).toBeDefined();
	});
});
