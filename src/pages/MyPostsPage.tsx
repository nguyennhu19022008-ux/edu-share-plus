import { useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import StudentHeader from '../components/student/StudentHeader';
import MyPostsFilters from '../features/my-posts/components/MyPostsFilters';
import MyPostsSummary from '../features/my-posts/components/MyPostsSummary';
import OwnerPostCard from '../features/my-posts/components/OwnerPostCard';
import type { MyPost, MyPostSort, MyPostStatus } from '../features/my-posts/types';
import { doneButtonText, myPostStatusLabel, normalizeMyPostText } from '../features/my-posts/viewUtils';

export default function MyPostsPage() {
  const { ownerPosts, ownerDetail } = useDataAccess();
  const [items, setItems] = useState<MyPost[]>(() => ownerPosts.list());
  const [status, setStatus] = useState<'' | MyPostStatus>('');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<MyPostSort>('new');
  const [notice, setNotice] = useState('');

  const dashboard = useMemo(() => {
    const result = { total:items.length, open:0, done:0, needAction:0 };
    items.forEach((post) => {
      if (post.status === 'Đang mở') result.open += 1;
      if (post.status === 'Đã xong') result.done += 1;
      if (post.status === 'Từ chối' || post.contactViewCount > post.contactedCount) result.needAction += 1;
    });
    return result;
  }, [items]);

  const filteredItems = useMemo(() => {
    const kw = normalizeMyPostText(keyword);
    const list = items.filter((post) => {
      if (status && post.status !== status) return false;
      if (!kw) return true;
      const haystack = normalizeMyPostText([
        post.title,
        post.description,
        post.tradeType,
        post.category,
        myPostStatusLabel(post.status),
        post.rejectionReason || '',
      ].join(' '));
      return haystack.includes(kw);
    });

    return [...list].sort((a,b) => {
      if (sort === 'contacts') return b.contactViewCount - a.contactViewCount || b.dateTs - a.dateTs;
      if (sort === 'comments') return b.commentCount - a.commentCount || b.dateTs - a.dateTs;
      if (sort === 'needAction') {
        const score = (post:MyPost) => (post.status === 'Từ chối' ? 1000 : 0) + Math.max(0, post.contactViewCount - post.contactedCount);
        return score(b) - score(a) || b.dateTs - a.dateTs;
      }
      return (b.doneTs || b.dateTs) - (a.doneTs || a.dateTs);
    });
  }, [items, keyword, sort, status]);

  const countStatus = (target:'' | MyPostStatus) => items.filter((post) => !target || post.status === target).length;
  const clearFilters = () => { setStatus(''); setKeyword(''); setSort('new'); };

  const updatePost = (id:string, updater:(post:MyPost)=>MyPost, message:string):MyPost | undefined => {
    const updated = ownerPosts.update(id, updater);
    if (updated) setItems(ownerPosts.list());
    setNotice(message);
    return updated;
  };

  const toggleHidden = (post:MyPost) => {
    const nextHidden = !post.hidden;
    if (!window.confirm(nextHidden ? 'Tạm ẩn bài khỏi trang chủ?' : 'Hiển thị lại bài trên trang chủ?')) return;
    const updated = updatePost(post.id, (current) => ({ ...current, hidden:nextHidden }), nextHidden ? 'Đã tạm ẩn bài trong phiên local.' : 'Đã hiển thị lại bài trong phiên local.');
    if (updated) ownerDetail.prependTimeline(updated, { type:'post', title:nextHidden ? 'Bài được tạm ẩn' : 'Bài được hiển thị lại', description:nextHidden ? 'Chủ bài tạm ẩn bài khỏi Marketplace.' : 'Chủ bài hiển thị lại bài trên Marketplace.', date:'Vừa xong • phiên local' });
  };

  const completePost = (post:MyPost) => {
    if (!window.confirm(`Xác nhận ${doneButtonText(post.tradeType).toLowerCase()} và chuyển bài sang lịch sử?`)) return;
    const updated = updatePost(post.id, (current) => ({ ...current, status:'Đã xong', source:'Archive', hidden:false, doneTs:Date.now() }), 'Đã đánh dấu hoàn tất trong phiên local.');
    if (updated) ownerDetail.prependTimeline(updated, { type:'post', title:'Bài đã hoàn tất', description:`Chủ bài xác nhận ${doneButtonText(post.tradeType).toLowerCase()} và chuyển bài vào lịch sử.`, date:'Vừa xong • phiên local' });
  };

  const withdrawPost = (post:MyPost) => {
    if (!window.confirm('Thu hồi bài đăng này? Bài sẽ không còn hiển thị công khai và được lưu vào lịch sử.')) return;
    const updated = updatePost(post.id, (current) => ({ ...current, status:'Đã thu hồi', source:'Archive', hidden:false, doneTs:Date.now() }), 'Đã thu hồi bài trong phiên local.');
    if (updated) ownerDetail.prependTimeline(updated, { type:'post', title:'Bài đã được thu hồi', description:'Chủ bài thu hồi bài khỏi Marketplace và chuyển vào lịch sử.', date:'Vừa xong • phiên local' });
  };

  const duplicatePost = (post:MyPost) => {
    if (!window.confirm('Nhân bản bài này thành bài mới ở trạng thái chờ duyệt?')) return;
    const duplicate = ownerPosts.duplicate(post);
    setItems(ownerPosts.list());
    setNotice('Đã tạo bản sao local ở trạng thái chờ duyệt.');
    window.setTimeout(() => navigateLegacy('editPost', { id:duplicate.id }), 450);
  };

  return (
    <>
      <StudentHeader activePage="myPosts" />
      <main className="container ecom-page owner-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">QUẢN LÝ TIN ĐĂNG</span>
            <h1>Bài đăng của tôi</h1>
            <p>Học sinh - 12A1 • local-ui@edushare.test</p>
          </div>
          <button className="btn primary" type="button" onClick={() => navigateLegacy('add')}>+ Đăng bài mới</button>
        </section>

        <MyPostsSummary dashboard={dashboard} />
        <MyPostsFilters status={status} keyword={keyword} sort={sort} resultCount={filteredItems.length} countStatus={countStatus} onStatus={setStatus} onKeyword={setKeyword} onSort={setSort} onClear={clearFilters} />

        {notice ? <div className="state ok owner-local-notice" role="status">{notice}</div> : null}

        <section className="owner-post-grid">
          {filteredItems.length ? filteredItems.map((post) => (
            <OwnerPostCard key={post.id} post={post} onToggleHidden={() => toggleHidden(post)} onComplete={() => completePost(post)} onWithdraw={() => withdrawPost(post)} onDuplicate={() => duplicatePost(post)} />
          )) : <div className="state">Bạn chưa có bài đăng phù hợp.</div>}
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
