import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { message, personaType, personaName, language } = body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const systemPrompt = `You are ${personaName}, a ${personaType} AI companion. Keep responses concise (max 200 words). Language: ${language === 'hi' ? 'Hindi' : language === 'kn' ? 'Kannada' : 'English'}. Be supportive and engaging.`;
    
    const result = await model.generateContent([systemPrompt, message]);
    const response = await result.response;
    const aiResponse = response.text();

    return NextResponse.json({ response: aiResponse });
    
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
