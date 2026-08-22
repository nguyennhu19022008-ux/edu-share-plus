import { FormEvent, useEffect, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import {
  createMyComment,
  deleteMyComment,
  listPostComments,
  revealPostContact,
  setPostSaved,
} from '../features/interactions/interactionService';
import type { CommentView, ContactRevealView } from '../features/interactions/interactionModel';
import {
  loadMarketplaceDetail,
  readRequestedMarketplacePostId,
  type MarketplaceDetailLoadState,
} from '../features/marketplace/marketplaceDetailPageModel';
import { getMarketplacePost } from '../features/marketplace/marketplaceReadService';
import type { MarketplaceReadPost } from '../features/marketplace/types';
import { listPostMedia } from '../features/storage/mediaService';
import type { SignedMedia } from '../features/storage/mediaModel';

function formatMoney(value:number) {
  return value > 0 ? `${new Intl.NumberFormat('vi-VN').format(value)} ₫` : 'Miễn phí / Thỏa thuận';
}

function formatCommentTime(value:string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh',
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  }).format(date);
}

function errorMessage(reason:unknown, fallback:string) {
  return reason instanceof Error ? reason.message : fallback;
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
  const [requestedPostId] = useState(() => readRequestedMarketplacePostId(window.location.search));
  const [loadState, setLoadState] = useState<MarketplaceDetailLoadState>({ status:'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const [media, setMedia] = useState<SignedMedia[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [saved, setSaved] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [viewerOwnsPost, setViewerOwnsPost] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [revealedContact, setRevealedContact] = useState<ContactRevealView | null>(null);
  const [interactionError, setInteractionError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadState({ status:'loading' });
    setMedia([]);
    setMediaError('');
    setComments([]);
    setCommentsLoading(false);
    setInteractionError('');
    setRevealedContact(null);

    void loadMarketplaceDetail(
      requestedPostId || '',
      (postId) => getMarketplacePost(postId),
    ).then((state) => {
      if (!active) return;
      setLoadState(state);
      if (state.status !== 'ready') return;

      const postId = state.detail.post.id;
      setSaved(state.detail.viewerSaved);
      setViewerOwnsPost(state.detail.viewerOwnsPost);
      setFavoriteCount(state.detail.post.favoriteCount);

      void listPostMedia(postId)
        .then((items) => {
          if (active) setMedia(items);
        })
        .catch((reason:unknown) => {
          if (active) setMediaError(errorMessage(reason, 'Không thể tải ảnh bài đăng.'));
        });

      setCommentsLoading(true);
      void listPostComments(postId)
        .then((items) => {
          if (active) setComments(items);
        })
        .catch((reason:unknown) => {
          if (active) setInteractionError(errorMessage(reason, 'Không thể tải bình luận.'));
        })
        .finally(() => {
          if (active) setCommentsLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [requestedPostId, retryKey]);

  if (loadState.status !== 'ready') {
    return <DetailState state={loadState} onRetry={() => setRetryKey((value) => value + 1)} />;
  }

  const { post, similarPosts, commentsEnabled } = loadState.detail;

  const refreshComments = async () => {
    const items = await listPostComments(post.id);
    setComments(items);
  };

  const toggleSaved = async () => {
    if (favoriteBusy || viewerOwnsPost) return;
    const previousSaved = saved;
    const previousCount = favoriteCount;
    const next = !saved;
    setFavoriteBusy(true);
    setInteractionError('');
    setSaved(next);
    setFavoriteCount(Math.max(0, previousCount + (next ? 1 : -1)));

    try {
      await setPostSaved(post.id, next);
      const freshDetail = await getMarketplacePost(post.id);
      setSaved(freshDetail.viewerSaved);
      setViewerOwnsPost(freshDetail.viewerOwnsPost);
      setFavoriteCount(freshDetail.post.favoriteCount);
      setLoadState({ status:'ready', detail:freshDetail });
    } catch (reason:unknown) {
      setSaved(previousSaved);
      setFavoriteCount(previousCount);
      setInteractionError(errorMessage(reason, 'Không thể cập nhật bài đã lưu.'));
    } finally {
      setFavoriteBusy(false);
    }
  };

  const sendComment = async (event:FormEvent) => {
    event.preventDefault();
    if (!commentsEnabled || commentBusy) return;
    const content = commentText.trim();
    if (!content) {
      setInteractionError('Vui lòng nhập nội dung bình luận.');
      return;
    }

    setCommentBusy(true);
    setInteractionError('');
    try {
      await createMyComment(post.id, content, null);
      setCommentText('');
      await refreshComments();
    } catch (reason:unknown) {
      setInteractionError(errorMessage(reason, 'Không thể gửi bình luận.'));
    } finally {
      setCommentBusy(false);
    }
  };

  const replyTo = async (comment:CommentView) => {
    if (!commentsEnabled || commentBusy) return;
    const content = window.prompt(`Trả lời bình luận của ${comment.authorName}:`);
    if (!content?.trim()) return;

    setCommentBusy(true);
    setInteractionError('');
    try {
      await createMyComment(post.id, content.trim(), comment.id);
      await refreshComments();
    } catch (reason:unknown) {
      setInteractionError(errorMessage(reason, 'Không thể gửi phản hồi.'));
    } finally {
      setCommentBusy(false);
    }
  };

  const removeComment = async (comment:CommentView) => {
    if (!comment.canDelete || deletingCommentId) return;
    if (!window.confirm('Xóa bình luận này? Nội dung sẽ không còn hiển thị cho người dùng thông thường.')) return;

    setDeletingCommentId(comment.id);
    setInteractionError('');
    try {
      await deleteMyComment(comment.id);
      await refreshComments();
    } catch (reason:unknown) {
      setInteractionError(errorMessage(reason, 'Không thể xóa bình luận.'));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const revealContact = async () => {
    if (contactBusy || viewerOwnsPost) return;
    setContactBusy(true);
    setInteractionError('');
    try {
      const contact = await revealPostContact(post.id);
      setRevealedContact(contact);
    } catch (reason:unknown) {
      setRevealedContact(null);
      setInteractionError(errorMessage(reason, 'Không thể xem thông tin liên hệ.'));
    } finally {
      setContactBusy(false);
    }
  };

  const reportPost = () => {
    const note = window.prompt('Nhập lý do báo cáo bài đăng:');
    if (note === null) return;
    window.alert('Báo cáo hiện chưa gửi lên backend. Workflow báo cáo thật thuộc Phase 5H.');
  };

  const reportComment = () => {
    const note = window.prompt('Nhập lý do báo cáo bình luận:');
    if (note === null) return;
    window.alert('Báo cáo bình luận hiện chưa gửi lên backend. Workflow báo cáo thật thuộc Phase 5H.');
  };

  const roots = comments.filter((comment) => comment.parentId === null);
  const repliesFor = (parentId:string) => comments.filter((comment) => comment.parentId === parentId);

  const renderComment = (comment:CommentView, isReply=false) => (
    <div className={`comment-item${isReply ? ' comment-reply' : ''}`} key={comment.id}>
      <div className="title-cell">
        {comment.authorName}{comment.authorClassName ? ` - ${comment.authorClassName}` : ''}
      </div>
      <div className="meta">{formatCommentTime(comment.createdAt)}</div>
      <div className="desc">{comment.body ?? 'Bình luận đã được tác giả xóa'}</div>
      <div style={{ marginTop:8 }}>
        {!comment.isDeleted ? (
          <button className="linkbtn" type="button" disabled={!commentsEnabled || commentBusy} onClick={() => void replyTo(comment)}>Trả lời</button>
        ) : null}
        {comment.canDelete ? (
          <button className="linkbtn danger" type="button" disabled={deletingCommentId === comment.id} onClick={() => void removeComment(comment)}>
            {deletingCommentId === comment.id ? 'Đang xóa...' : 'Xóa'}
          </button>
        ) : null}
        {!comment.isDeleted ? <button className="linkbtn danger" type="button" onClick={reportComment}>Báo cáo — Phase 5H</button> : null}
      </div>
    </div>
  );

  return (
    <>
      <StudentHeader activePage="detail" />
      <main className="container detail-market-page ecom-page">
        <div className="breadcrumb">
          <button type="button" onClick={() => navigateLegacy('index')}>Trang chủ</button>
          <span>›</span>
          <b>Chi tiết bài đăng</b>
        </div>

        {interactionError ? <div className="state error" style={{ marginBottom:12 }}>{interactionError}</div> : null}

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
                <b>Dữ liệu bài đăng, lượt lưu, bình luận và luồng liên hệ đang dùng backend thật.</b> Ảnh được phân phối bằng URL ký ngắn hạn. Báo cáo vẫn thuộc Phase 5H.
              </div>

              {revealedContact ? (
                <div className="contact-card">
                  <div className="title-cell">{revealedContact.method === 'email' ? 'Email liên hệ' : 'Số điện thoại liên hệ'}</div>
                  <div>{revealedContact.value}</div>
                  <div className="meta" style={{ marginTop:6 }}>
                    Lần xem thông tin liên hệ này được ghi nhận trong nhật ký truy cập để chủ bài có thể kiểm tra.
                  </div>
                </div>
              ) : null}

              <div className="actions split-actions" style={{ marginTop:16 }}>
                {!viewerOwnsPost ? (
                  <button className={`btn ghost save-btn${saved ? ' saved' : ''}`} type="button" disabled={favoriteBusy} onClick={() => void toggleSaved()}>
                    {favoriteBusy ? 'Đang cập nhật...' : saved ? '♥ Đã lưu' : '♡ Lưu bài'} ({favoriteCount})
                  </button>
                ) : <span className="meta">Bài đăng của bạn • {favoriteCount} lượt lưu</span>}
                {!viewerOwnsPost ? (
                  <button className="btn orange" type="button" disabled={contactBusy} onClick={() => void revealContact()}>
                    {contactBusy ? 'Đang kiểm tra...' : revealedContact ? 'Xem lại liên hệ' : 'Xem liên hệ'}
                  </button>
                ) : null}
                <button className="btn gray" type="button" onClick={reportPost}>Báo cáo — Phase 5H</button>
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
          <div className="meta" style={{ marginBottom:12 }}>Bình luận được đọc và ghi qua backend với danh tính hiển thị theo thiết lập quyền riêng tư hiện tại.</div>
          {commentsEnabled ? (
            <form className="comment-box" onSubmit={(event) => void sendComment(event)}>
              <textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Nhập bình luận lịch sự, rõ nội dung..."
                maxLength={2000}
                disabled={commentBusy}
              />
              <button className="btn primary" type="submit" disabled={commentBusy}>{commentBusy ? 'Đang gửi...' : 'Gửi bình luận'}</button>
            </form>
          ) : <div className="state">Bình luận đã bị tắt cho bài đăng này.</div>}

          <div className="comment-box" style={{ marginTop:10 }}>
            {commentsLoading ? <div className="state">Đang tải bình luận...</div> : !roots.length ? <div className="state">Chưa có bình luận.</div> : roots.map((comment) => (
              <div key={comment.id}>
                {renderComment(comment)}
                {repliesFor(comment.id).map((reply) => renderComment(reply, true))}
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
