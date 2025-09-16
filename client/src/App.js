import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import AutocompleteInput from './components/AutocompleteInput';
import ProfilePage from './components/ProfilePage'; // Import ProfilePage
import './App.css';

const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

// Main App Component - now contains routing logic
function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/profile/:nickname" element={<ProfilePage />} />
    </Routes>
  );
}

// The original App component is renamed to MainPage
function MainPage() {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [sidebarView, setSidebarView] = useState('categories');
  const [sortType, setSortType] = useState('latest');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [tempKakaoId, setTempKakaoId] = useState(null);
  const [countedVideoIds, setCountedVideoIds] = useState([]); // State for client-side optimization
  const ws = useRef(null);

  const gameSuggestions = [
    '메이플스토리',
    '이터널리턴',
    '리그 오브 레전드',
    '오버워치 2',
    '발로란트',
    '배틀그라운드',
    '로스트아크',
    '던전앤파이터',
    '스타크래프트',
    '디아블로 4',
    '원신',
    '붕괴: 스타레일',
    'FC 온라인',
    '피파 온라인 4',
    '카트라이더: 드리프트',
    '마인크래프트',
    '젤다의 전설: 티어스 오브 더 킹덤',
    '마리오 카트 8 디럭스',
    '포트나이트',
    '어몽 어스',
  ];

  useEffect(() => {
    if (!ws.current) {
      ws.current = new WebSocket(WS_URL);
      ws.current.onopen = () => console.log('C: 웹소켓 연결 성공!');
      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'NEW_VIDEO') {
          setVideos(prevVideos => [message.payload, ...prevVideos]);
        }
      };
      ws.current.onclose = () => console.log('C: 웹소켓 연결 종료.');
      ws.current.onerror = (error) => console.error('C: 웹소켓 에러 발생:', error);
    }
    return () => {
      if (ws.current && ws.current.readyState === 1) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    const newUserParam = urlParams.get('new_user');
    const kakaoIdParam = urlParams.get('kakao_id');

    if (userParam) { // Case 1: User just logged in via Kakao redirect
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        setCurrentUser(user);
        setIsLoggedIn(true);
        localStorage.setItem('currentUser', JSON.stringify(user)); // Store user
      } catch (error) {
        console.error("Failed to parse user data from URL", error);
      }
      // Clean the URL
      window.history.replaceState({}, document.title, "/");
    } else if (newUserParam === 'true' && kakaoIdParam) { // Case 2: New user needs to set nickname
      setTempKakaoId(kakaoIdParam);
      setIsNicknameModalOpen(true);
      // Clean the URL
      window.history.replaceState({}, document.title, "/");
    } else { // Case 3: Normal page load or refresh
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          setIsLoggedIn(true);
        } catch (error) {
          console.error("Failed to parse user data from localStorage", error);
          localStorage.removeItem('currentUser');
        }
      }
    }
  }, []);

  // Effect for counting video views
  useEffect(() => {
    if (selectedVideo && !countedVideoIds.includes(selectedVideo.id)) {
      fetch(`${API_URL}/videos/${selectedVideo.id}/view`, {
        method: 'POST',
      })
      .then(res => res.json())
      .then(data => {
        console.log('View count response:', data.message);
        // Check if the server successfully updated the count
        if (data.message === 'View count updated.') {
          // Update the local state to reflect the new view count immediately
          setVideos(currentVideos =>
            currentVideos.map(video =>
              video.id === selectedVideo.id
                ? { ...video, views: video.views + 1 }
                : video
            )
          );
        }
        // Add to session-counted list regardless of server response to prevent re-sends
        setCountedVideoIds(prev => [...prev, selectedVideo.id]);
      })
      .catch(err => {
        console.error('Failed to send view count:', err);
        // Also add to counted list on error to prevent spamming a failing endpoint
        setCountedVideoIds(prev => [...prev, selectedVideo.id]);
      });
    }
  }, [selectedVideo, countedVideoIds]);

  const fetchVideos = (sort = 'latest', category = null) => {
    let url = `${API_URL}/videos?sort=${sort}`;
    if (category) {
      url += `&game=${encodeURIComponent(category)}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => setVideos(data))
      .catch(err => console.error('영상을 불러오는데 실패했습니다:', err));
  };

  useEffect(() => {
    fetchVideos(sortType, selectedCategory);
  }, [sortType, selectedCategory]);

  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('카테고리를 불러오는데 실패했습니다:', err));

    fetch(`${API_URL}/subscriptions`)
      .then(res => res.json())
      .then(data => setSubscriptions(data))
      .catch(err => console.error('구독 정보를 불러오는데 실패했습니다:', err));
  }, []);

  const handleSearch = (query) => {
    if (query) {
      fetch(`${API_URL}/videos/search?title=${query}`)
        .then(res => res.json())
        .then(data => setVideos(data))
        .catch(err => console.error('영상 검색에 실패했습니다:', err));
    } else {
      fetchVideos(sortType);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`http://localhost:3001/auth/kakao`);
      const { kakaoAuthURL } = await response.json();
      window.location.href = kakaoAuthURL;
    } catch (error) {
      console.error("Failed to get Kakao auth URL", error);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    window.location.href = "/";
  };

  const handleNicknameSubmit = async (nickname) => {
    if (!nickname || !tempKakaoId) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kakao_id: tempKakaoId, nickname }),
      });
      const newUser = await response.json();
      if (!response.ok) {
        throw new Error(newUser.message || 'Failed to create user');
      }
      setCurrentUser(newUser);
      setIsLoggedIn(true);
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      setIsNicknameModalOpen(false);
      setTempKakaoId(null);
    } catch (error) {
      console.error('Error setting nickname:', error);
      alert(`닉네임 설정 실패: ${error.message}`);
    }
  };

  const handleUpload = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/videos`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`업로드 실패: ${data.message || '알 수 없는 오류'}`);
        return;
      }
      setIsUploadModalOpen(false);
    } catch (err) {
      console.error('업로드 실패:', err);
      alert(`업로드 실패: ${err.message}`);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('정말로 이 영상을 삭제하시겠습니까?')) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/videos/${videoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '영상 삭제 실패');
      }
      setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
      alert('영상이 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('영상 삭제 중 오류 발생:', error);
      alert(`영상 삭제 실패: ${error.message}`);
    }
  };

  return (
    <div className="app">
      <Header 
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSearch={handleSearch} 
        onSubscriptionsClick={() => setSidebarView(prevView => prevView === 'subscriptions' ? 'categories' : 'subscriptions')} 
        onLogoClick={() => setSidebarView('categories')} 
        onUploadClick={() => setIsUploadModalOpen(true)}
        sidebarView={sidebarView}
      />
      <div className="main-body">
        <Sidebar 
          view={sidebarView}
          categories={categories}
          subscriptions={subscriptions} 
          onCategorySelect={setSelectedCategory}
          gameSuggestions={gameSuggestions}
        />
        <Content 
          videos={videos} 
          sortType={sortType}
          onSortChange={setSortType} 
          onVideoSelect={setSelectedVideo} 
          selectedVideo={selectedVideo} 
          onVideoClose={() => setSelectedVideo(null)} 
          onVideoDelete={handleDeleteVideo}
        />
      </div>
      {isUploadModalOpen && (
        <UploadModal 
          currentUser={currentUser}
          onClose={() => setIsUploadModalOpen(false)} 
          onSubmit={handleUpload}
          gameSuggestions={gameSuggestions}
        />
      )}
      {isNicknameModalOpen && (
        <NicknameModal onSubmit={handleNicknameSubmit} />
      )}
    </div>
  );
}

const NicknameModal = ({ onSubmit }) => {
  const [nickname, setNickname] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(nickname);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>닉네임 설정</h2>
        <p>GHighlights에 오신 것을 환영합니다! 사용할 닉네임을 입력해주세요.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nickname">닉네임</label>
            <input 
              type="text" 
              id="nickname" 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)} 
              placeholder="2자 이상 10자 이하"
              minLength="2"
              maxLength="10"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-btn">확인</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Header = ({ isLoggedIn, currentUser, onLogin, onLogout, onSearch, onSubscriptionsClick, onLogoClick, onUploadClick, sidebarView }) => {
  const [query, setQuery] = useState('');
  const handleSearchSubmit = (e) => { e.preventDefault(); onSearch(query); };
  const buttonText = sidebarView === 'subscriptions' ? '카테고리' : '구독';
  return (
    <header className="header">
      <div className="logo" onClick={onLogoClick}>GHighlights</div>
      <div className="header-right">
        <form onSubmit={handleSearchSubmit} className="search-bar"><input type="text" placeholder="제목으로 영상 검색..." value={query} onChange={(e) => setQuery(e.target.value)}/></form>
        <button className="header-button" onClick={onSubscriptionsClick}>{buttonText}</button>
        {isLoggedIn ? (
          <>
            <Link to={`/profile/${currentUser.nickname}`} className="username-link">
              <span className="username">환영합니다, {currentUser.nickname}님!</span>
            </Link>
            <button className="header-button" onClick={onUploadClick}>영상 업로드</button>
            <button className="header-button" onClick={onLogout}>로그아웃</button>
          </>
        ) : (<button className="header-button" onClick={onLogin}>카카오로 로그인</button>)}
      </div>
    </header>
  );
};

const Sidebar = ({ view, categories, subscriptions, onCategorySelect, gameSuggestions }) => {
  const isSubscriptionView = view === 'subscriptions';
  const title = isSubscriptionView ? '구독한 채널' : '게임 카테고리';
  const listItems = isSubscriptionView ? subscriptions : gameSuggestions.map(game => ({ id: game, name: game }));

  return (
    <aside className="sidebar">
      <h3>{title}</h3>
      <ul>
        {listItems.map(item => (
          <li key={item.id} onClick={() => onCategorySelect(item.name)}>
            {item.name}
          </li>
        ))}
      </ul>
    </aside>
  );
};

const Content = ({ videos, sortType, onSortChange, onVideoSelect, selectedVideo, onVideoClose, onVideoDelete }) => {
  if (selectedVideo) {
    return (
      <div className="video-player-fullscreen">
        <button className="close-video-player" onClick={onVideoClose}>X</button>
        <video controls autoPlay className="full-screen-video" src={selectedVideo.video_url}></video>
        <h2>{selectedVideo.title}</h2>
        <p>게시자: {selectedVideo.user}</p>
        <p>조회수: {selectedVideo.views} | 좋아요: {selectedVideo.likes}</p>
      </div>
    );
  }

  return (
    <main className="content">
      <div className="sort-buttons">
        <button className={sortType === 'latest' ? 'active' : ''} onClick={() => onSortChange('latest')}>최신순</button>
        <button className={sortType === 'views' ? 'active' : ''} onClick={() => onSortChange('views')}>조회순</button>
        <button className={sortType === 'popular' ? 'active' : ''} onClick={() => onSortChange('popular')}>인기순</button>
      </div>
      <div className="video-list">
        {videos.map(video => (
          <div key={video.id} className="video-card">
            <div onClick={() => onVideoSelect(video)}>
              <video controls className="video-player" src={video.video_url}></video>
              <h4>{video.title}</h4>
              <p>게시자: {video.user}</p>
              <p>조회수: {video.views} | 좋아요: {video.likes}</p>
            </div>
            <button className="delete-video-button" onClick={() => onVideoDelete(video.id)}>삭제</button>
          </div>
        ))}
      </div>
    </main>
  );
};

const UploadModal = ({ currentUser, onClose, onSubmit, gameSuggestions }) => {
  const [title, setTitle] = useState('');
  const [game, setGame] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [uploaderName, setUploaderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalUserName = currentUser ? currentUser.nickname : uploaderName;

    if (!title || !game || !videoFile || !finalUserName) {
      alert('모든 필드를 채워주세요.');
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('game', game);
    formData.append('video', videoFile);
    formData.append('user', finalUserName);

    try {
      await onSubmit(formData);
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>새 영상 업로드</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label htmlFor="title">영상 제목</label><input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="form-group">
            <label htmlFor="game">게임 이름</label>
            <AutocompleteInput
              id="game"
              value={game}
              onChange={setGame}
              suggestions={gameSuggestions}
              placeholder="게임 이름을 입력하세요"
              strict={true}
            />
          </div>
          {!currentUser && (
            <div className="form-group">
              <label htmlFor="uploaderName">업로더 이름</label>
              <input type="text" id="uploaderName" value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} placeholder="이름을 입력하세요" />
            </div>
          )}
          <div className="form-group"><label htmlFor="video">영상 파일</label><input type="file" id="video" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} /></div>
          <div className="form-actions"><button type="submit" className="submit-btn" disabled={isUploading}>{isUploading ? '업로드 중...' : '업로드'}</button><button type="button" className="cancel-btn" onClick={onClose} disabled={isUploading}>취소</button></div>
        </form>
      </div>
    </div>
  );
};

export default App;
