import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import StudentHeader from '../components/student/StudentHeader';
import type { MyPost } from '../features/my-posts/types';

const CATEGORIES = [
  'Sách',
  'Sách giáo khoa',
  'Sách tham khảo',
  'Dụng cụ học tập',
  'Vở',
  'Bút',
  'Đồng phục',
  'Đồ điện tử nhỏ',
  'Khác',
] as const;

const TRADE_TYPES = ['Cho mượn', 'Cho tặng', 'Trao đổi', 'Bán giá rẻ'] as const;

type SubmitState =
  | { tone:'idle'; message:'' }
  | { tone:'ok'; message:string }
  | { tone:'error'; message:string };

export default function AddPostPage() {
  const { ownerPosts } = useDataAccess();
  const [tradeType, setTradeType] = useState<(typeof TRADE_TYPES)[number]>('Cho mượn');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [uploadMessage, setUploadMessage] = useState('Hỗ trợ hầu hết định dạng ảnh phổ biến, kể cả HEIC/HEIF, TIFF và một số ảnh RAW. Hệ thống sẽ chuyển về JPEG tối ưu trước khi tải lên.');
  const [submitState, setSubmitState] = useState<SubmitState>({ tone:'idle', message:'' });
  const [submitting, setSubmitting] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);

  const isSale = tradeType === 'Bán giá rẻ';

  useEffect(() => () => {
    if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSubmitState({ tone:'idle', message:'' });

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewName('');

    if (!file) {
      setUploadMessage('Hỗ trợ hầu hết định dạng ảnh phổ biến, kể cả HEIC/HEIF, TIFF và một số ảnh RAW. Hệ thống sẽ chuyển về JPEG tối ưu trước khi tải lên.');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      event.target.value = '';
      setUploadMessage('Ảnh vượt quá giới hạn 30 MB của luồng nguồn. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPreviewName(file.name);
    setUploadMessage('Bản local Phase 1: ảnh chỉ được xem trước trong trình duyệt. Chưa tải lên Google Drive hay Object Storage.');
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const description = String(data.get('description') || '').trim();
    const contactInfo = String(data.get('contactInfo') || '').trim();
    const rawPrice = String(data.get('price') || '').trim();

    if (!title || !description || !contactInfo) {
      setSubmitState({ tone:'error', message:'Vui lòng nhập đầy đủ các trường bắt buộc.' });
      return;
    }

    if (isSale) {
      const price = Number(rawPrice.replace(/[^0-9]/g, ''));
      if (!Number.isFinite(price) || price <= 0) {
        setSubmitState({ tone:'error', message:'Vui lòng nhập giá bán hợp lệ cho hình thức Bán giá rẻ.' });
        return;
      }
    }

    setSubmitting(true);
    const category = String(data.get('category') || 'Khác').trim();
    const price = isSale ? Number(rawPrice.replace(/[^0-9]/g, '')) : 0;
    const now = Date.now();
    const newPost:MyPost = {
      id:`LOCAL-NEW-${now}`,
      title:title.slice(0, 140),
      description:description.slice(0, 3000),
      tradeType,
      category,
      className:'12A1',
      price,
      status:'Chờ duyệt',
      source:'Posts',
      hidden:false,
      date:'Vừa tạo trong phiên local',
      dateTs:now,
      favoriteCount:0,
      contactViewCount:0,
      contactedCount:0,
      commentCount:0,
      reportCount:0,
      contactInfo:contactInfo.slice(0, 300),
    };
    ownerPosts.insert(newPost);

    // Phase 1: chỉ lưu bài vào in-memory owner store để kiểm tra flow xuyên trang.
    // Ảnh vẫn chỉ là preview local và chưa được giữ sau khi rời form vì Storage chưa triển khai.
    setSubmitState({ tone:'ok', message:'Đã tạo bài local ở trạng thái chờ giáo viên duyệt. Đang chuyển tới Bài của tôi…' });

    redirectTimerRef.current = window.setTimeout(() => {
      navigateLegacy('myPosts');
    }, 1100);
  };

  return (
    <>
      <StudentHeader activePage="add" />
      <main className="container narrow ecom-page add-post-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">ĐĂNG BÁN / CHIA SẺ</span>
            <h1>Đăng bài mới</h1>
            <p>Bài đăng sẽ ở trạng thái chờ giáo viên kiểm duyệt trước khi công khai.</p>
          </div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button>
        </section>

        <form className="card form-shell ecom-form-card" onSubmit={onSubmit}>
          <div className="form-guide">
            <div className="guide-item"><i>1</i><b>Mô tả tốt</b><span>Nêu rõ tình trạng, số lượng và lớp phù hợp.</span></div>
            <div className="guide-item"><i>2</i><b>Ảnh thật</b><span>Chụp rõ món đồ, không dùng ảnh mờ.</span></div>
            <div className="guide-item"><i>3</i><b>Chờ duyệt</b><span>Bài sẽ hiển thị sau khi giáo viên kiểm tra.</span></div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="req" htmlFor="add-title">Tiêu đề</label>
              <input id="add-title" name="title" required maxLength={140} placeholder="Nhập tiêu đề bài đăng rõ ràng" />
            </div>
            <div className="field">
              <label className="req" htmlFor="add-trade">Loại bài đăng</label>
              <select id="add-trade" name="tradeType" required value={tradeType} onChange={(event) => setTradeType(event.target.value as (typeof TRADE_TYPES)[number])}>
                {TRADE_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="req" htmlFor="add-category">Danh mục</label>
              <select id="add-category" name="category" required defaultValue="Sách">
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="add-price">Giá nếu bán</label>
              <input
                id="add-price"
                name="price"
                inputMode="numeric"
                disabled={!isSale}
                placeholder={isSale ? 'Nhập giá bán mong muốn, VD: 30000' : 'Không cần nhập giá cho hình thức này'}
              />
            </div>
          </div>

          <div className="field">
            <label className="req" htmlFor="add-description">Mô tả tình trạng đồ</label>
            <textarea id="add-description" name="description" required maxLength={3000} placeholder="Nêu tình trạng, số lượng, lớp phù hợp và cách giao nhận mong muốn." />
          </div>

          <div className="field">
            <label className="req" htmlFor="add-contact">Thông tin liên hệ</label>
            <input id="add-contact" name="contactInfo" required maxLength={300} placeholder="SĐT/Zalo hoặc liên kết Facebook để người cần liên hệ" />
          </div>

          <div className="field upload-zone">
            <label htmlFor="add-file">Ảnh minh họa</label>
            <input id="add-file" type="file" accept="image/*,.heic,.heif,.hif,.avif,.tif,.tiff,.bmp,.dib,.gif,.jfif,.jpe,.ico,.svg,.dng,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.orf,.rw2,.pef,.raf,.raw,.jxl" onChange={onImageChange} />
            {previewUrl ? <img className="upload-preview local-preview-visible" src={previewUrl} alt={`Ảnh xem trước ${previewName}`} /> : null}
            <div className="form-note">{uploadMessage}</div>
          </div>

          <button type="submit" className="btn primary full" disabled={submitting}>{submitting ? 'Đang tạo bài…' : 'Gửi bài chờ duyệt'}</button>
          {submitState.tone !== 'idle' ? (
            <div className={`state ${submitState.tone === 'ok' ? 'ok' : 'error'} add-submit-state`}>{submitState.message}</div>
          ) : null}
        </form>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
