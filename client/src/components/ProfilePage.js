import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../App.css'; // Use the main App's CSS for a similar feel

const API_URL = 'http://211.105.35.84:3001/api';

function ProfilePage() {
  const { nickname } = useParams();
  const [userVideos, setUserVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserVideos = async () => {
      try {
        const response = await fetch(`${API_URL}/videos/user/${nickname}`);
        if (!response.ok) {
          throw new Error('사용자의 비디오를 불러오는데 실패했습니다.');
        }
        const data = await response.json();
        setUserVideos(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserVideos();
  }, [nickname]);

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (error) {
    return <div className="error">에러: {error}</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">{nickname}님의 프로필</div>
        <div className="header-right">
          <Link to="/" className="header-button">메인으로 돌아가기</Link>
        </div>
      </header>
      <main className="content" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
        <h2>{nickname}님이 올린 동영상 ({userVideos.length}개)</h2>
        <div className="video-list">
          {userVideos.length > 0 ? (
            userVideos.map(video => (
              <div key={video.id} className="video-card">
                <div>
                  <video controls className="video-player" src={video.video_url}></video>
                  <h4>{video.title}</h4>
                  <p>게시자: {video.user}</p>
                  <p>조회수: {video.views} | 좋아요: {video.likes}</p>
                </div>
              </div>
            ))
          ) : (
            <p>이 사용자가 올린 동영상이 없습니다.</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;