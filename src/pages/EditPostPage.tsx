import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import StudentHeader from '../components/student/StudentHeader';
import type { MyPost } from '../features/my-posts/types';

const CATEGORIES = ['Sách','Sách giáo khoa','Sách tham khảo','Dụng cụ học tập','Vở','Bút','Đồng phục','Đồ điện tử nhỏ','Khác'] as const;
const TRADE_TYPES = ['Cho mượn','Cho tặng','Trao đổi','Bán giá rẻ'] as const;

function getPostId():string {
  return new URLSearchParams(window.location.search).get('id')?.trim() || '';
}

export default function EditPostPage() {
  const { ownerPosts, ownerDetail } = useDataAccess();
  const postId = getPostId();
  const [post] = useState<MyPost | undefined>(() => ownerPosts.getById(postId));
  const [tradeType, setTradeType] = useState<MyPost['tradeType']>(() => post?.tradeType || 'Cho mượn');
  const [priceValue, setPriceValue] = useState(() => post?.tradeType === 'Bán giá rẻ' && post.price ? String(post.price) : '');
  const [previewUrl, setPreviewUrl] = useState(post?.imageUrl || '');
  const [newObjectUrl, setNewObjectUrl] = useState('');
  const [uploadMessage, setUploadMessage] = useState(post?.imageUrl ? 'Đã có ảnh hiện tại. Có thể chọn ảnh khác để thay đổi.' : 'Hỗ trợ nhiều định dạng ảnh phổ biến.');
  const [message, setMessage] = useState<{tone:'idle'|'ok'|'error'; text:string}>({ tone:'idle', text:'' });
  const [submitting, setSubmitting] = useState(false);
  const savedObjectUrlRef = useRef('');
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
    if (newObjectUrl && savedObjectUrlRef.current !== newObjectUrl) URL.revokeObjectURL(newObjectUrl);
  }, [newObjectUrl]);

  if (!post) {
    return (
      <>
        <StudentHeader activePage="editPost" />
        <main className="container narrow ecom-page"><section className="ecom-page-title"><div><span className="eyebrow">CHỈNH SỬA BÀI</span><h1>Chỉnh sửa bài đăng</h1></div></section><div className="state error">Không tìm thấy bài đăng local.</div><button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button></main>
      </>
    );
  }

  const canEdit = post.source !== 'Archive' && ['Chờ duyệt','Từ chối','Đang mở'].includes(post.status);
  const isSale = tradeType === 'Bán giá rẻ';

  const onImageChange = (event:ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setMessage({ tone:'idle', text:'' });
    if (newObjectUrl && savedObjectUrlRef.current !== newObjectUrl) URL.revokeObjectURL(newObjectUrl);
    setNewObjectUrl('');

    if (!file) {
      setPreviewUrl(post.imageUrl || '');
      setUploadMessage(post.imageUrl ? 'Đang giữ ảnh hiện tại. Chọn ảnh mới nếu muốn thay đổi.' : 'Có thể chọn ảnh ở hầu hết định dạng phổ biến.');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      event.target.value = '';
      setPreviewUrl(post.imageUrl || '');
      setUploadMessage('Ảnh vượt quá giới hạn 30 MB của luồng nguồn. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setNewObjectUrl(objectUrl);
    setPreviewUrl(objectUrl);
    setUploadMessage('Phase 1 local: ảnh mới chỉ được xem trước trong trình duyệt; chưa tải lên Object Storage.');
  };

  const onSubmit = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || submitting) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') || '').trim();
    const description = String(data.get('description') || '').trim();
    const contactInfo = String(data.get('contactInfo') || '').trim();
    const category = String(data.get('category') || '').trim();
    const rawPrice = String(data.get('price') || '').trim();

    if (!title || !description || !contactInfo) {
      setMessage({ tone:'error', text:'Vui lòng nhập đầy đủ các trường bắt buộc.' });
      return;
    }
    let price = 0;
    if (isSale) {
      price = Number(rawPrice.replace(/[^0-9]/g, ''));
      if (!Number.isFinite(price) || price <= 0) {
        setMessage({ tone:'error', text:'Vui lòng nhập giá bán hợp lệ cho hình thức Bán giá rẻ.' });
        return;
      }
    }

    setSubmitting(true);
    const nextPost:MyPost = {
      ...post,
      title:title.slice(0, 140),
      tradeType,
      category,
      description:description.slice(0, 3000),
      contactInfo:contactInfo.slice(0, 300),
      price,
      imageUrl:previewUrl || '',
      status:'Chờ duyệt',
      source:'Posts',
      hidden:false,
      rejectionReason:'',
    };
    ownerPosts.replace(nextPost);
    ownerDetail.prependTimeline(nextPost, { type:'post', title:'Bài được chỉnh sửa và gửi duyệt lại', description:'Chủ bài cập nhật thông tin; trạng thái chuyển về chờ giáo viên duyệt.', date:'Vừa xong • phiên local' });
    if (newObjectUrl) savedObjectUrlRef.current = newObjectUrl;
    setMessage({ tone:'ok', text:'Đã lưu local. Bài đã chuyển về trạng thái chờ giáo viên duyệt lại, đúng workflow cũ.' });
    redirectTimerRef.current = window.setTimeout(() => navigateLegacy('myDetail', { id:post.id }), 900);
  };

  return (
    <>
      <StudentHeader activePage="editPost" />
      <main className="container narrow ecom-page edit-post-page">
        <section className="ecom-page-title">
          <div><span className="eyebrow">CHỈNH SỬA BÀI</span><h1>Chỉnh sửa bài đăng</h1><p>Sau khi lưu, bài sẽ chuyển về trạng thái chờ giáo viên duyệt lại.</p></div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button>
        </section>

        <div className="form-guide">
          <div className="guide-item"><i>1</i><b>Kiểm tra góp ý</b><span>Đọc lý do từ chối nếu có.</span></div>
          <div className="guide-item"><i>2</i><b>Cập nhật chính xác</b><span>Sửa mô tả, ảnh và liên hệ.</span></div>
          <div className="guide-item"><i>3</i><b>Gửi duyệt lại</b><span>Bài đang mở sẽ tạm rời trang chủ.</span></div>
        </div>

        <section className="card ecom-form-card">
          {!canEdit ? (
            <div className="state error">Bài đã lưu trữ không thể chỉnh sửa. Hãy nhân bản nếu muốn đăng lại.</div>
          ) : (
            <form onSubmit={onSubmit}>
              {post.rejectionReason ? <div className="reason-box"><b>Lý do cần chỉnh sửa: </b>{post.rejectionReason}</div> : null}
              <div className="grid-2">
                <div className="field"><label className="req" htmlFor="edit-title">Tiêu đề</label><input id="edit-title" name="title" required maxLength={140} defaultValue={post.title} /></div>
                <div className="field"><label className="req" htmlFor="edit-trade">Loại bài đăng</label><select id="edit-trade" name="tradeType" required value={tradeType} onChange={(event) => { const next = event.target.value as MyPost['tradeType']; setTradeType(next); if (next !== 'Bán giá rẻ') setPriceValue(''); }}>{TRADE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
                <div className="field"><label className="req" htmlFor="edit-category">Danh mục</label><select id="edit-category" name="category" required defaultValue={post.category}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div>
                <div className="field"><label htmlFor="edit-price">Giá nếu bán</label><input id="edit-price" name="price" type="number" min="0" disabled={!isSale} value={priceValue} onChange={(event) => setPriceValue(event.target.value)} placeholder={isSale ? 'Nhập giá bán mong muốn, VD: 30000' : 'Không cần nhập giá cho hình thức này'} /></div>
              </div>
              <div className="field"><label className="req" htmlFor="edit-description">Mô tả tình trạng món đồ</label><textarea id="edit-description" name="description" required maxLength={3000} defaultValue={post.description} /></div>
              <div className="field"><label className="req" htmlFor="edit-contact">Thông tin liên hệ</label><input id="edit-contact" name="contactInfo" required maxLength={300} defaultValue={post.contactInfo || ''} /></div>
              <div className="field upload-zone">
                <label htmlFor="edit-file">Ảnh minh họa</label>
                <input id="edit-file" type="file" accept="image/*,.heic,.heif,.hif,.avif,.tif,.tiff,.bmp,.dib,.gif,.jfif,.jpe,.ico,.svg,.dng,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.orf,.rw2,.pef,.raf,.raw,.jxl" onChange={onImageChange} />
                {previewUrl ? <img className="upload-preview local-preview-visible" src={previewUrl} alt="Ảnh xem trước" /> : null}
                <div className="form-note">{uploadMessage}</div>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn primary" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Lưu và gửi duyệt lại'}</button>
                <button type="button" className="btn gray" onClick={() => navigateLegacy('myDetail', { id:post.id })}>Hủy</button>
              </div>
              {message.tone !== 'idle' ? <div className={`state ${message.tone === 'ok' ? 'ok' : 'error'} add-submit-state`}>{message.text}</div> : null}
            </form>
          )}
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
