import { FormEvent, useEffect, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import StudentHeader from '../components/student/StudentHeader';
import {
  loadMarketplaceDetail,
  readRequestedMarketplacePostId,
  type MarketplaceDetailLoadState,
} from '../features/marketplace/marketplaceDetailPageModel';
import { getMarketplacePost } from '../features/marketplace/marketplaceReadService';
import type { MarketplaceReadPost } from '../features/marketplace/types';
import { listPostMedia } from '../features/storage/mediaService';
import type { SignedMedia } from '../features/storage/mediaModel';

type LocalComment = {
  id: string;
  parentId?: string;
  name: string;
  className?: string;
  date: string;
  content: string;
};

const LOCAL_UI_COMMENTS: LocalComment[] = [
  { id:'LC-001', name:'Học sinh', className:'11A2', date:'10/08/2026 17:04', content:'Bạn cho mình hỏi đồ dùng này hiện còn không ạ?' },
  { id:'LC-002', parentId:'LC-001', name:'Học sinh', className:'12A1', date:'10/08/2026 17:12', content:'Hiện bài vẫn đang mở nhé.' },
];

function formatMoney(value: number) {
  return value > 0 ? `${new Intl.NumberFormat('vi-VN').format(value)} ₫` : 'Miễn phí / Thỏa thuận';
}

function DetailState({ state, onRetry }:{ state:MarketplaceDetailLoadState; onRetry:()=>void }) {
  let content;
  if (state.status === 'loading') {
    content = <div className="state">Đang tải chi tiết bài đăng...</div>;
  } else if (state.status === 'notFound') {
    content = <div className="state error">Không tìm thấy bài đăng hoặc bạn không có quyền xem bài này.</div>;
  } else {
    content = (
      <div className="state error">
        <div>{state.status === 'error' ? state.message : 'Không thể tải chi tiết bài đăng.'}</div>
        <button className="btn primary" type="button" onClick={onRetry} style={{ marginTop:10 }}>Thử lại</button>
      </div>
    );
  }

  return (
    <>
      <StudentHeader activePage="detail" />
      <main className="container detail-market-page ecom-page">
        <div className="breadcrumb"><button type="button" onClick={() => navigateLegacy('index')}>Trang chủ</button><span>›</span><b>Chi tiết bài đăng</b></div>
        {content}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}

function SimilarPosts({ posts }:{ posts:MarketplaceReadPost[] }) {
  if (!posts.length) return <div className="state">Chưa có bài tương tự.</div>;
  return (
    <div className="mini-grid">
      {posts.map((item) => (
        <article className="mini-card" key={item.id} onClick={() => navigateLegacy('detail', { id:item.id })}>
          <b>{item.title || 'Bài đăng'}</b>
          <span>{item.tradeType || ''} • {item.category || ''}</span>
          <small>{formatMoney(item.price)}</small>
        </article>
      ))}
    </div>
  );
}

export default function DetailPage() {
  const { profile } = useDataAccess();
  const [requestedPostId] = useState(() => readRequestedMarketplacePostId(window.location.search));
  const [loadState, setLoadState] = useState<MarketplaceDetailLoadState>({ status:'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const [media, setMedia] = useState<SignedMedia[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [saved, setSaved] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [comments, setComments] = useState<LocalComment[]>(LOCAL_UI_COMMENTS);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    let active = true;
    setLoadState({ status:'loading' });
    setContactVisible(false);
    setMedia([]);
    setMediaError('');

    void loadMarketplaceDetail(
      requestedPostId || '',
      (postId) => getMarketplacePost(postId),
    ).then((state) => {
      if (!active) return;
      setLoadState(state);
      if (state.status !== 'ready') return;

      setSaved(profile.isPostSaved(state.detail.post.id));
      void listPostMedia(state.detail.post.id)
        .then((items) => {
          if (active) setMedia(items);
        })
        .catch((reason:unknown) => {
          if (active) setMediaError(reason instanceof Error ? reason.message : 'Không thể tải ảnh bài đăng.');
        });
    });

    return () => {
      active = false;
    };
  }, [profile, requestedPostId, retryKey]);

  if (loadState.status !== 'ready') {
    return <DetailState state={loadState} onRetry={() => setRetryKey((value) => value + 1)} />;
  }

  const { post, similarPosts, commentsEnabled } = loadState.detail;
  const initiallySaved = profile.wasPostInitiallySaved(post.id);
  const favoriteCount = Math.max(0, Number(post.favoriteCount || 0) + (saved ? 1 : 0) - (initiallySaved ? 1 : 0));

  const toggleSaved = () => {
    const next = !saved;
    profile.setPostSaved(post.id, next);
    setSaved(next);
  };

  const sendComment = (event: FormEvent) => {
    event.preventDefault();
    if (!commentsEnabled) {
      window.alert('Bình luận của bài đăng này đang bị tắt.');
      return;
    }
    const content = commentText.trim();
    if (!content) {
      window.alert('Vui lòng nhập nội dung bình luận.');
      return;
    }
    setComments((current) => [...current, {
      id:`LOCAL-${Date.now()}`,
      name:'Học sinh',
      className:'',
      date:new Intl.DateTimeFormat('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date()),
      content,
    }]);
    setCommentText('');
  };

  const replyTo = (comment: LocalComment) => {
    if (!commentsEnabled) {
      window.alert('Bình luận của bài đăng này đang bị tắt.');
      return;
    }
    const content = window.prompt(`Trả lời bình luận của ${comment.name || 'người dùng'}:`);
    if (!content?.trim()) return;
    setComments((current) => [...current, {
      id:`LOCAL-${Date.now()}`,
      parentId:comment.id,
      name:'Học sinh',
      date:'Vừa xong',
      content:content.trim(),
    }]);
  };

  const reportPost = () => {
    const note = window.prompt('Nhập lý do báo cáo bài đăng:');
    if (note === null) return;
    window.alert('Báo cáo hiện chỉ là mô phỏng local. Backend thật sẽ được nối ở Phase 5H.');
  };

  const reportComment = () => {
    const note = window.prompt('Nhập lý do báo cáo bình luận:');
    if (note === null) return;
    window.alert('Báo cáo bình luận hiện chỉ là mô phỏng local. Backend thật sẽ được nối ở Phase 5H.');
  };

  const roots = comments.filter((comment) => !comment.parentId);
  const repliesFor = (parentId:string) => comments.filter((comment) => comment.parentId === parentId);

  return (
    <>
      <StudentHeader activePage="detail" />
      <main className="container detail-market-page ecom-page">
        <div className="breadcrumb">
          <button type="button" onClick={() => navigateLegacy('index')}>Trang chủ</button>
          <span>›</span>
          <b>Chi tiết bài đăng</b>
        </div>

        <section>
          <div className="detail-layout">
            <section className="card" style={{ padding:18 }}>
              <div className="tags">
                <span className="tag">{post.tradeType}</span>
                <span className="tag cat">{post.category}</span>
                <span className="tag price">{formatMoney(post.price)}</span>
              </div>
              <h1 style={{ margin:'12px 0 8px', fontSize:28, lineHeight:1.2 }}>{post.title || 'Bài đăng'}</h1>
              <div className="meta owner-line">
                <span>Người đăng: {post.name || 'Ẩn danh'}{post.className ? ` - ${post.className}` : ''} • {post.date || ''}</span>
                <span className="reputation-chip">Uy tín: {post.ownerReputationScore || 5}/10 • {post.ownerReputationLabel || 'Bình thường'}</span>
              </div>
              <div className="desc" style={{ marginTop:14 }}>{post.description || 'Chưa có mô tả.'}</div>
              <div className="privacy-note">
                <b>Dữ liệu bài đăng đang đọc từ Supabase.</b> Ảnh được phân phối bằng URL ký ngắn hạn; favorite, bình luận, liên hệ và báo cáo vẫn là mô phỏng local cho tới các phase 5G–5H.
              </div>

              {contactVisible ? (
                <div className="contact-card">
                  <div className="title-cell">Liên hệ — mô phỏng local</div>
                  <div className="meta">Không có dữ liệu liên hệ thật được trả về ở Phase 5C.</div>
                  <div>Workflow liên hệ được kiểm tra giao diện local và sẽ nối RPC có audit ở Phase 5G.</div>
                </div>
              ) : null}

              <div className="actions split-actions" style={{ marginTop:16 }}>
                <button className={`btn ghost save-btn${saved ? ' saved' : ''}`} type="button" onClick={toggleSaved}>{saved ? '♥ Đã lưu' : '♡ Lưu bài'} ({favoriteCount})</button>
                <button className="btn orange" type="button" onClick={() => setContactVisible(true)}>Xem luồng liên hệ (local)</button>
                <button className="btn gray" type="button" onClick={reportPost}>Báo cáo (local)</button>
                <button className="btn primary" type="button" onClick={() => navigateLegacy('index')}>Quay lại trang chủ</button>
              </div>
            </section>

            {media.length ? (
              <div className="detail-media-gallery">
                {media.map((item) => (
                  <img
                    key={item.fileId}
                    src={item.signedUrl}
                    alt={item.altText || `Ảnh bài đăng ${item.sortOrder + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            ) : mediaError ? (
              <div className="state">{mediaError}</div>
            ) : (
              <div className="state">Bài đăng chưa có ảnh khả dụng.</div>
            )}
          </div>
        </section>

        <section className="panel ecom-section-panel">
          <h2 style={{ margin:'0 0 12px' }}>Bài tương tự</h2>
          <SimilarPosts posts={similarPosts} />
        </section>

        <section className="panel ecom-section-panel">
          <h2 style={{ margin:'0 0 4px' }}>Bình luận</h2>
          <div className="meta" style={{ marginBottom:12 }}>Mô phỏng local — chưa đọc/ghi bảng comments ở Phase 5C.</div>
          {commentsEnabled ? (
            <form className="comment-box" onSubmit={sendComment}>
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Nhập bình luận lịch sự, rõ nội dung..." maxLength={1200} />
              <button className="btn primary" type="submit">Gửi bình luận local</button>
            </form>
          ) : <div className="state">Bình luận đã bị tắt cho bài đăng này.</div>}

          <div className="comment-box" style={{ marginTop:10 }}>
            {!roots.length ? <div className="state">Chưa có bình luận.</div> : roots.map((comment) => (
              <div key={comment.id}>
                <div className="comment-item">
                  <div className="title-cell">{comment.name || 'Người dùng'}{comment.className ? ` - ${comment.className}` : ''}</div>
                  <div className="meta">{comment.date || ''}</div>
                  <div className="desc">{comment.content || ''}</div>
                  <div style={{ marginTop:8 }}>
                    <button className="linkbtn" type="button" disabled={!commentsEnabled} onClick={() => replyTo(comment)}>Trả lời</button>
                    <button className="linkbtn danger" type="button" onClick={reportComment}>Báo cáo local</button>
                  </div>
                </div>
                {repliesFor(comment.id).map((reply) => (
                  <div className="comment-item comment-reply" key={reply.id}>
                    <div className="title-cell">{reply.name || 'Người dùng'}{reply.className ? ` - ${reply.className}` : ''}</div>
                    <div className="meta">{reply.date || ''}</div>
                    <div className="desc">{reply.content || ''}</div>
                    <div style={{ marginTop:8 }}>
                      <button className="linkbtn" type="button" disabled={!commentsEnabled} onClick={() => replyTo(reply)}>Trả lời</button>
                      <button className="linkbtn danger" type="button" onClick={reportComment}>Báo cáo local</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
