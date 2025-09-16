const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3001;

// Supabase Client Initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key are required. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

const broadcast = (message) => {
  console.log(`${clients.size}명의 클라이언트에게 브로드캐스트합니다:`, message);
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

wss.on('connection', (ws) => {
  console.log('클라이언트가 연결되었습니다.');
  clients.add(ws);
  console.log(`현재 접속자 수: ${clients.size}`);

  ws.on('close', () => {
    console.log('클라이언트 연결이 끊겼습니다.');
    clients.delete(ws);
    console.log(`현재 접속자 수: ${clients.size}`);
  });
});

app.use(cors());
app.use(express.json());
app.set('trust proxy', true); // IP 주소를 정확히 파악하기 위한 설정

// KAKAO LOGIN
const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

app.get('/auth/kakao', (req, res) => {
  const kakaoAuthURL = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
  res.json({ kakaoAuthURL });
});

app.get('/auth/kakao/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: 'Authorization code is missing.' });
  }

  try {
    // 1. Get Access Token
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    // 2. Get User Info (for Kakao ID)
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();
    if (userData.code) throw new Error(userData.msg);

    const kakaoId = userData.id;

    // 3. Check if user exists in our DB
    const { data: existingUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116: row not found
      throw dbError;
    }

    if (existingUser) {
      // User exists, log them in
      res.redirect(`http://localhost:3000?user=${encodeURIComponent(JSON.stringify(existingUser))}`);
    } else {
      // New user, prompt for nickname
      res.redirect(`http://localhost:3000?new_user=true&kakao_id=${kakaoId}`);
    }

  } catch (error) {
    console.error('Kakao login error:', error);
    res.status(500).json({ message: 'Kakao login failed.', details: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { kakao_id, nickname } = req.body;

  if (!kakao_id || !nickname) {
    return res.status(400).json({ message: 'Kakao ID and nickname are required.' });
  }

  // Check if nickname is already taken
  const { data: existingNickname, error: nicknameError } = await supabase
    .from('users')
    .select('id')
    .eq('nickname', nickname)
    .single();

  if (existingNickname) {
    return res.status(409).json({ message: 'Nickname is already taken.' });
  }
  if (nicknameError && nicknameError.code !== 'PGRST116') {
    return res.status(500).json({ message: 'Error checking nickname', details: nicknameError.message });
  }

  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({ kakao_id, nickname })
    .select()
    .single();

  if (createError) {
    console.error('Error creating user:', createError);
    return res.status(500).json({ message: 'Failed to create user.', details: createError.message });
  }

  res.status(201).json(newUser);
});

const upload = multer({ storage: multer.memoryStorage() });

const mockCategories = [
  { id: 'zelda', name: 'Zelda' },
  { id: 'mario-kart', name: 'Mario Kart' },
  { id: 'fortnite', name: 'Fortnite' },
  { id: 'lol', name: 'League of Legends' },
  { id: 'minecraft', name: 'Minecraft' },
  { id: 'among-us', name: 'Among Us' },
];
const mockSubscriptions = [
  { id: 'gaming-god', name: 'GamingGod' },
  { id: 'speed-runner', name: 'SpeedRunner' },
  { id: 'lol-pro', name: 'LoLPro' },
];

app.get('/api/categories', (req, res) => res.json(mockCategories));
app.get('/api/subscriptions', (req, res) => res.json(mockSubscriptions));

app.get('/api/videos', async (req, res) => {
  const { sort, game } = req.query;
  let query = supabase.from('videos').select('*');

  if (game) {
    query = query.eq('game', game); // 게임 이름으로 필터링
  }

  if (sort === 'views') {
    query = query.order('views', { ascending: false });
  } else if (sort === 'popular') {
    query = query.order('likes', { ascending: false });
  }
  else {
    query = query.order('uploaded_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching videos from Supabase:', error.message); // Log the specific error message
    return res.status(500).json({ message: 'Failed to fetch videos', details: error.message }); // Send details to client
  }

  res.json(data);
});

app.get('/api/videos/search', async (req, res) => {
    const { title } = req.query;
    if (!title) return res.status(400).json({ message: 'Title query is required' });

    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .ilike('title', `%${title}%`); // Case-insensitive search

    if (error) {
        console.error('Error searching videos from Supabase:', error);
        return res.status(500).json({ message: 'Failed to search videos' });
    }

    res.json(data);
});

app.get('/api/videos/user/:nickname', async (req, res) => {
    const { nickname } = req.params;
    if (!nickname) return res.status(400).json({ message: 'Nickname is required' });

    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user', nickname)
        .order('uploaded_at', { ascending: false });

    if (error) {
        console.error('Error fetching user videos from Supabase:', error);
        return res.status(500).json({ message: 'Failed to fetch user videos' });
    }

    res.json(data);
});

app.post('/api/videos', upload.single('video'), async (req, res) => {
    const { title, game, user } = req.body;
    const videoFile = req.file; // file is in memory due to multer.memoryStorage()

    if (!title || !game || !user || !videoFile) {
        return res.status(400).json({ message: '모든 필드를 채워야 합니다.' });
    }

    const fileName = `${Date.now()}-${videoFile.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos') // Using the bucket named 'videos' for consistency
        .upload(fileName, videoFile.buffer, {
            contentType: videoFile.mimetype,
            upsert: false,
        });

    if (uploadError) {
        console.error('Error uploading video to Supabase Storage:', uploadError);
        return res.status(500).json({ message: 'Failed to upload video' });
    }

    const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

    const videoUrl = publicUrlData.publicUrl;

    const { data: newVideo, error: insertError } = await supabase
        .from('videos')
        .insert([
            {
                title,
                game,
                user,
                video_url: videoUrl,
                views: 0,
                likes: 0,
                uploaded_at: new Date().toISOString(),
            },
        ])
        .select(); // Use .select() to return the inserted data

    if (insertError) {
        console.error('Error inserting video metadata into Supabase Database:', insertError);
        return res.status(500).json({ message: 'Failed to save video metadata' });
    }

    console.log('새 영상 업로드됨. 브로드캐스트 시작...');
    broadcast({ type: 'NEW_VIDEO', payload: newVideo[0] }); // newVideo is an array, take the first element
    res.status(201).json(newVideo[0]);
});

app.delete('/api/videos/:id', async (req, res) => {
    const { id } = req.params;

    // 1. Supabase에서 비디오 정보 가져오기 (video_url을 얻기 위함)
    const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('video_url')
        .eq('id', id)
        .single();

    if (fetchError || !video) {
        console.error('Error fetching video for deletion:', fetchError?.message || 'Video not found');
        return res.status(404).json({ message: 'Video not found or error fetching video details.' });
    }

    // video_url에서 파일 이름 추출 및 디코딩
    const fileName = decodeURIComponent(video.video_url.split('/').pop());
    console.log('Attempting to delete file from storage. Decoded FileName:', fileName);

    // 2. Supabase Storage에서 비디오 파일 삭제
    const { error: storageError } = await supabase.storage
        .from('videos')
        .remove([fileName]);

    if (storageError) {
        console.error('Error deleting video from Supabase Storage:', storageError);
        // 스토리지 삭제 실패해도 DB 삭제는 시도 (부분 성공)
    } else {
        console.log('Successfully attempted to delete file from storage. No storageError reported.');
    }

    // 3. Supabase 데이터베이스에서 비디오 레코드 삭제
    const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

    if (dbError) {
        console.error('Error deleting video from Supabase Database:', dbError);
        return res.status(500).json({ message: 'Failed to delete video record from database.' });
    }

    // 4. 성공 응답
    res.status(200).json({ message: 'Video deleted successfully.' });
});

app.post('/api/videos/:id/view', async (req, res) => {
  const { id: videoId } = req.params;
  // IP 주소를 더 안정적으로 가져오기
  const ipAddress = req.ip || req.socket.remoteAddress;
  console.log(`View request received for video ${videoId} from IP ${ipAddress}`);

  if (!videoId) {
    return res.status(400).json({ message: 'Video ID is required.' });
  }
  if (!ipAddress) {
    return res.status(400).json({ message: 'Could not determine IP address.' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log('Checking for recent view...');

    const { data: existingView, error: selectError } = await supabase
      .from('view_history')
      .select('id')
      .eq('video_id', videoId)
      .eq('ip_address', ipAddress)
      .gt('viewed_at', twentyFourHoursAgo)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking view history:', selectError);
      return res.status(500).json({ message: 'Error checking view history.' });
    }

    if (!existingView) {
      console.log('No recent view found. Proceeding to increment count.');

      const { error: rpcError } = await supabase.rpc('increment_views', {
        video_id_to_update: videoId,
      });

      if (rpcError) {
        console.error('Error incrementing view count via RPC:', rpcError);
        return res.status(500).json({ message: 'Error incrementing view count.' });
      }
      console.log('Successfully incremented view count in videos table.');

      const { error: insertError } = await supabase
        .from('view_history')
        .insert({ video_id: videoId, ip_address: ipAddress });

      if (insertError) {
        console.error('Error inserting into view_history:', insertError);
        // Note: This error is not returned to client as the main goal (incrementing) succeeded.
      }
      console.log('Successfully inserted into view_history.');

      return res.status(200).json({ message: 'View count updated.' });
    } else {
      console.log('Recent view found. Not incrementing.');
      return res.status(200).json({ message: 'View already counted within 24 hours.' });
    }
  } catch (error) {
    console.error('Error processing view count:', error);
    return res.status(500).json({ message: 'An unexpected error occurred while processing view count.' });
  }
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(500).json({ message: 'An unexpected error occurred.', error: err.message });
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
