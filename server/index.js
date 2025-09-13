const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');

const app = express();
const port = 3001;

// --- 데이터 영속성을 위한 파일 처리 --- //
const VIDEOS_FILE_PATH = path.join(__dirname, 'videos.json');

const readVideosFromFile = () => {
  try {
    const data = fs.readFileSync(VIDEOS_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('videos.json 파일을 읽는 데 실패했습니다. 새 파일을 생성합니다.');
    return [];
  }
};

const writeVideosToFile = (videos) => {
  fs.writeFileSync(VIDEOS_FILE_PATH, JSON.stringify(videos, null, 2), 'utf8');
};

let mockVideos = readVideosFromFile();
// ------------------------------------ //

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

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

app.get('/api/videos', (req, res) => {
  const { sort } = req.query;
  let videos = [...mockVideos];
  if (sort === 'views') videos.sort((a, b) => b.views - a.views);
  else if (sort === 'popular') videos.sort((a, b) => b.likes - a.likes);
  else videos.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
  res.json(videos);
});

app.get('/api/videos/search', (req, res) => {
    const { title } = req.query;
    if (!title) return res.status(400).json({ message: 'Title query is required' });
    const filteredVideos = mockVideos.filter(v => v.title.toLowerCase().includes(title.toLowerCase()));
    res.json(filteredVideos);
});

app.post('/api/videos', upload.single('video'), (req, res) => {
    const { title, game, user } = req.body;
    const videoFile = req.file;
    if (!title || !game || !user || !videoFile) {
        return res.status(400).json({ message: '모든 필드를 채워야 합니다.' });
    }
    const videoUrl = `http://localhost:${port}/uploads/${videoFile.filename}`;
    const newVideo = {
        id: mockVideos.length > 0 ? Math.max(...mockVideos.map(v => v.id)) + 1 : 1,
        title, game, user, videoUrl,
        views: 0, likes: 0,
        uploaded_at: new Date().toISOString(),
    };
    mockVideos.unshift(newVideo);
    writeVideosToFile(mockVideos); // 파일에 저장
    console.log('새 영상 업로드됨. 브로드캐스트 시작...');
    broadcast({ type: 'NEW_VIDEO', payload: newVideo });
    res.status(201).json(newVideo);
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
