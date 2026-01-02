import { NextRequest, NextResponse } from 'next/server';
import { jwtDecode } from 'jwt-decode';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    
    const decoded = jwtDecode<{ email: string, name: string, picture: string }>(token);
    
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', decoded.email)
      .single();

    let userId;
    
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser } = await supabaseAdmin
        .from('users')
        .insert({
          email: decoded.email,
          name: decoded.name,
          avatar_url: decoded.picture
        })
        .select('id')
        .single();

      userId = newUser!.id;
    }

    const response = NextResponse.json({ userId });
    response.cookies.set('userId', userId, { httpOnly: true });
    return response;
    
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
  }
}