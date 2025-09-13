import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

// 메인 앱 컴포넌트
function App() {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [sidebarView, setSidebarView] = useState('categories');
  const [sortType, setSortType] = useState('latest');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const ws = useRef(null); // 웹소켓 인스턴스를 저장하기 위한 Ref

  // 웹소켓 연결 (useRef를 사용하여 한번만 실행되도록 보장)
  useEffect(() => {
    if (!ws.current) {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('C: 웹소켓 연결 성공!');
      };

      ws.current.onmessage = (event) => {
        console.log('C: 서버로부터 메시지 수신:', event.data);
        const message = JSON.parse(event.data);
        if (message.type === 'NEW_VIDEO') {
          console.log('C: NEW_VIDEO 메시지 확인, 영상 목록을 업데이트합니다.');
          setVideos(prevVideos => [message.payload, ...prevVideos]);
        }
      };

      ws.current.onclose = () => {
        console.log('C: 웹소켓 연결 종료.');
      };

      ws.current.onerror = (error) => {
        console.error('C: 웹소켓 에러 발생:', error);
      };
    }

    // 컴포넌트가 언마운트될 때 한번만 웹소켓 연결을 정리합니다.
    return () => {
      if (ws.current && ws.current.readyState === 1) { // OPEN 상태일 때만
        console.log('C: 웹소켓 연결을 닫습니다.');
        ws.current.close();
      }
    };
  }, []);

  const fetchVideos = (sort = 'latest') => {
    fetch(`${API_URL}/videos?sort=${sort}`)
      .then(res => res.json())
      .then(data => setVideos(data))
      .catch(err => console.error('영상을 불러오는데 실패했습니다:', err));
  };

  useEffect(() => {
    fetchVideos(sortType);
  }, [sortType]);

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

  const handleLogin = () => {
    setIsLoggedIn(true);
    setCurrentUser({ name: 'Gamer123' });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const handleUpload = (formData) => {
    fetch(`${API_URL}/videos`, {
      method: 'POST',
      body: formData,
    })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        alert(`업로드 실패: ${data.message}`);
        return;
      }
      setIsUploadModalOpen(false);
    })
    .catch(err => console.error('업로드 실패:', err));
  };

  return (
    <div className="app">
      <Header 
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSearch={handleSearch} 
        onSubscriptionsClick={() => setSidebarView('subscriptions')} 
        onLogoClick={() => setSidebarView('categories')} 
        onUploadClick={() => setIsUploadModalOpen(true)}
      />
      <div className="main-body">
        <Sidebar 
          view={sidebarView}
          categories={categories}
          subscriptions={subscriptions} 
        />
        <Content 
          videos={videos} 
          sortType={sortType}
          onSortChange={setSortType} 
        />
      </div>
      {isUploadModalOpen && (
        <UploadModal 
          currentUser={currentUser}
          onClose={() => setIsUploadModalOpen(false)} 
          onSubmit={handleUpload}
        />
      )}
    </div>
  );
}

// ... (Header, Sidebar, Content, UploadModal 컴포넌트는 이전과 동일) ...
const Header = ({ isLoggedIn, currentUser, onLogin, onLogout, onSearch, onSubscriptionsClick, onLogoClick, onUploadClick }) => {
  const [query, setQuery] = useState('');
  const handleSearchSubmit = (e) => { e.preventDefault(); onSearch(query); };
  return (
    <header className="header">
      <div className="logo" onClick={onLogoClick}>GHighlights</div>
      <div className="header-right">
        <form onSubmit={handleSearchSubmit} className="search-bar"><input type="text" placeholder="제목으로 영상 검색..." value={query} onChange={(e) => setQuery(e.target.value)}/></form>
        <button className="header-button" onClick={onSubscriptionsClick}>구독</button>
        {isLoggedIn ? (
          <>
            <span className="username">환영합니다, {currentUser.name}님!</span>
            <button className="header-button" onClick={onUploadClick}>영상 업로드</button>
            <button className="header-button" onClick={onLogout}>로그아웃</button>
          </>
        ) : (<button className="header-button" onClick={onLogin}>카카오로 로그인</button>)}
      </div>
    </header>
  );
};

const Sidebar = ({ view, categories, subscriptions }) => {
  const isSubscriptionView = view === 'subscriptions';
  const title = isSubscriptionView ? '구독한 채널' : '게임 카테고리';
  const listItems = isSubscriptionView ? subscriptions : categories;
  return (
    <aside className="sidebar">
      <h3>{title}</h3>
      <ul>{listItems.map(item => <li key={item.id}>{item.name}</li>)}</ul>
    </aside>
  );
};

const Content = ({ videos, sortType, onSortChange }) => {
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
            <video controls className="video-player" src={video.videoUrl}></video>
            <h4>{video.title}</h4>
            <p>게시자: {video.user}</p>
            <p>조회수: {video.views} | 좋아요: {video.likes}</p>
          </div>
        ))}
      </div>
    </main>
  );
};

const UploadModal = ({ currentUser, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [game, setGame] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !game || !videoFile) { alert('모든 필드를 채워주세요.'); return; }
    const formData = new FormData();
    formData.append('title', title);
    formData.append('game', game);
    formData.append('video', videoFile);
    formData.append('user', currentUser.name);
    onSubmit(formData);
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>새 영상 업로드</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label htmlFor="title">영상 제목</label><input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="game">게임 이름</label><input type="text" id="game" value={game} onChange={(e) => setGame(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="video">영상 파일</label><input type="file" id="video" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} /></div>
          <div className="form-actions"><button type="submit" className="submit-btn">업로드</button><button type="button" className="cancel-btn" onClick={onClose}>취소</button></div>
        </form>
      </div>
    </div>
  );
};

export default App;