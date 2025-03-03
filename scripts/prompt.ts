import OpenAI from 'openai';

const openai = new OpenAI();

export async function getResponse(prompt: string): Promise<string | null> {
	const response = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [{ role: 'user', content: prompt }],
	});

	return response.choices[0].message.content;
}
