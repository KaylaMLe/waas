import OpenAI from 'openai';

const openai = new OpenAI();

/**
 * Get a response from OpenAI's GPT-4o-mini model.
 * 
 * @param prompt - a string to send to the model as a message with the role of 'user'
 * @returns a promise that resolves to the model's response as a string, or null if an error occurs
 */
export async function getResponse(prompt: string): Promise<string | null> {
	const response = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [{ role: 'user', content: prompt }],
	});

	return response.choices[0].message.content;
}
