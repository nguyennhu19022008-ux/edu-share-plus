import { FormEvent, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import StudentHeader from '../components/student/StudentHeader';
import type { MarketPost } from '../features/marketplace/types';

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

function getRequestedPost(posts:MarketPost[]): MarketPost | null {
  const requestedId = new URLSearchParams(window.location.search).get('id') || posts[0]?.id;
  return posts.find((post) => post.id === requestedId) || null;
}

function localImageFor(post: MarketPost) {
  // Chỉ là asset kiểm tra giao diện local. Không phải ảnh nghiên cứu và không phải dữ liệu migration.
  if (post.id === 'UI-001') return '/assets/local-ui-books.jpg';
  return '';
}

export default function DetailPage() {
  const { marketplace, profile } = useDataAccess();
  const marketPosts=useMemo(()=>marketplace.listPosts(),[marketplace]);
  const [post] = useState<MarketPost | null>(() => getRequestedPost(marketPosts));
  const [saved, setSaved] = useState(() => post ? profile.isPostSaved(post.id) : false);
  const [contactVisible, setContactVisible] = useState(false);
  const [comments, setComments] = useState<LocalComment[]>(LOCAL_UI_COMMENTS);
  const [commentText, setCommentText] = useState('');
  const similarPosts = useMemo(() => {
    if (!post) return [];
    const preferred = marketPosts.filter((item) => item.id !== post.id && (item.category === post.category || item.tradeType === post.tradeType));
    const fallback = marketPosts.filter((item) => item.id !== post.id && !preferred.includes(item));
    return [...preferred, ...fallback].slice(0, 4);
  }, [marketPosts, post]);

  const initiallySaved = post ? profile.wasPostInitiallySaved(post.id) : false;
  const favoriteCount = Math.max(0, Number(post?.favoriteCount || 0) + (saved ? 1 : 0) - (initiallySaved ? 1 : 0));

  const toggleSaved = () => {
    if (!post) return;
    const next = !saved;
    profile.setPostSaved(post.id, next);
    setSaved(next);
  };

  const sendComment = (event: FormEvent) => {
    event.preventDefault();
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
    window.alert('Bản local đã kiểm tra được luồng Báo cáo. Backend thật sẽ được nối ở phase sau.');
  };

  const reportComment = () => {
    const note = window.prompt('Nhập lý do báo cáo bình luận:');
    if (note === null) return;
    window.alert('Bản local đã kiểm tra được luồng Báo cáo bình luận. Backend thật sẽ được nối ở phase sau.');
  };

  if (!post) {
    return (
      <>
        <StudentHeader activePage="detail" />
        <main className="container detail-market-page ecom-page">
          <div className="breadcrumb"><button type="button" onClick={() => navigateLegacy('index')}>Trang chủ</button><span>›</span><b>Chi tiết bài đăng</b></div>
          <div className="state error">Không tìm thấy bài đăng hoặc bài chưa được duyệt.</div>
        </main>
        <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
      </>
    );
  }

  const imageUrl = localImageFor(post);
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
                <b>Bảo vệ thông tin học sinh</b> — thông tin liên hệ chỉ hiển thị sau khi bấm Xem liên hệ và được ghi nhận lượt xem cho chủ bài.
              </div>

              {contactVisible ? (
                <div className="contact-card">
                  <div className="title-cell">Thông tin liên hệ người đăng</div>
                  <div className="meta">Người đăng: {post.name || ''}{post.className ? ` - ${post.className}` : ''}</div>
                  <div>Email: local-ui@example.invalid</div>
                  <div>Liên hệ: Dữ liệu kiểm thử UI local</div>
                </div>
              ) : null}

              <div className="actions split-actions" style={{ marginTop:16 }}>
                <button className={`btn ghost save-btn${saved ? ' saved' : ''}`} type="button" onClick={toggleSaved}>{saved ? '♥ Đã lưu' : '♡ Lưu bài'} ({favoriteCount})</button>
                <button className="btn orange" type="button" onClick={() => setContactVisible(true)}>Xem liên hệ</button>
                <button className="btn gray" type="button" onClick={reportPost}>Báo cáo bài đăng</button>
                <button className="btn primary" type="button" onClick={() => navigateLegacy('index')}>Quay lại trang chủ</button>
              </div>
            </section>

            {imageUrl ? (
              <img className="detail-img" src={imageUrl} alt="Ảnh bài đăng" loading="lazy" decoding="async" />
            ) : (
              <div className="state">Bài đăng chưa có ảnh.</div>
            )}
          </div>
        </section>

        <section className="panel ecom-section-panel">
          <h2 style={{ margin:'0 0 12px' }}>Bài tương tự</h2>
          {similarPosts.length ? (
            <div className="mini-grid">
              {similarPosts.map((item) => (
                <article className="mini-card" key={item.id} onClick={() => navigateLegacy('detail', { id:item.id })}>
                  <b>{item.title || 'Bài đăng'}</b>
                  <span>{item.tradeType || ''} • {item.category || ''}</span>
                  <small>{formatMoney(item.price)}</small>
                </article>
              ))}
            </div>
          ) : <div className="state">Chưa có bài tương tự.</div>}
        </section>

        <section className="panel ecom-section-panel">
          <h2 style={{ margin:'0 0 12px' }}>Bình luận</h2>
          <form className="comment-box" onSubmit={sendComment}>
            <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Nhập bình luận lịch sự, rõ nội dung..." maxLength={1200} />
            <button className="btn primary" type="submit">Gửi bình luận</button>
          </form>

          <div className="comment-box" style={{ marginTop:10 }}>
            {!roots.length ? <div className="state">Chưa có bình luận.</div> : roots.map((comment) => (
              <div key={comment.id}>
                <div className="comment-item">
                  <div className="title-cell">{comment.name || 'Người dùng'}{comment.className ? ` - ${comment.className}` : ''}</div>
                  <div className="meta">{comment.date || ''}</div>
                  <div className="desc">{comment.content || ''}</div>
                  <div style={{ marginTop:8 }}>
                    <button className="linkbtn" type="button" onClick={() => replyTo(comment)}>Trả lời</button>
                    <button className="linkbtn danger" type="button" onClick={reportComment}>Báo cáo</button>
                  </div>
                </div>
                {repliesFor(comment.id).map((reply) => (
                  <div className="comment-item comment-reply" key={reply.id}>
                    <div className="title-cell">{reply.name || 'Người dùng'}{reply.className ? ` - ${reply.className}` : ''}</div>
                    <div className="meta">{reply.date || ''}</div>
                    <div className="desc">{reply.content || ''}</div>
                    <div style={{ marginTop:8 }}>
                      <button className="linkbtn" type="button" onClick={() => replyTo(reply)}>Trả lời</button>
                      <button className="linkbtn danger" type="button" onClick={reportComment}>Báo cáo</button>
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
