export interface RecommendedPostItem {
  id: string;
  title: string;
  category: string;
  tradeType: string;
  price: number;
  className?: string | null;
  explanationTag: string;
  explanationReason: string;
  score: number;
}

function extractGradeFromClassName(className?: string | null): string | null {
  if (!className) return null;
  const match = className.match(/\b(10|11|12|[1-9])(?=[A-Za-z_/-]|\b)/) || className.match(/\d+/);
  return match ? match[0] : null;
}

function matchesStudentGrade(
  grade: string,
  titleLower: string,
  descLower: string,
  postClassName?: string | null,
): boolean {
  const postGrade = extractGradeFromClassName(postClassName);
  if (postGrade && postGrade === grade) {
    return true;
  }

  const escaped = grade.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const gradeKeywordPattern = new RegExp(
    `(?:lớp|khối|toán|vật\\s*lí|vật\\s*lý|lí|lý|hóa|hoá|ngữ\\s*văn|văn|tiếng\\s*anh|anh|sinh|lịch\\s*sử|sử|địa\\s*lí|địa\\s*lý|địa|gdcd|ktpl|tin\\s*học|tin|công\\s*nghệ|sgk|sách|đề\\s*cương|tài\\s*liệu|bài\\s*tập|chuyên\\s*đề)\\s*${escaped}(?!\\d|[.,]\\d|\\s*(?:k|đ|vnd|trang|quyển|cuốn|cây|cái|chiếc|tờ|bộ)\\b)`,
    'i',
  );

  return gradeKeywordPattern.test(titleLower) || gradeKeywordPattern.test(descLower);
}

export function generateRecommendations(
  posts: Array<{
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    tradeType: string;
    price: number;
    className?: string | null;
    schoolId?: string | null;
    hasImage?: boolean;
    favoriteCount?: number;
    ownerReputationScore?: number;
  }>,
  studentContext?: {
    className?: string | null;
    gradeLevel?: string | null;
    schoolName?: string | null;
  }
): RecommendedPostItem[] {
  if (!posts || !posts.length) return [];

  const grade = studentContext?.gradeLevel || extractGradeFromClassName(studentContext?.className);

  return posts.map((post) => {
    let score = 50;
    let explanationTag = 'Gợi ý cho bạn';
    let explanationReason = 'Phù hợp với nhu cầu học tập phổ biến trong trường.';

    const titleLower = post.title.toLowerCase();
    const descLower = (post.description || '').toLowerCase();
    const isGive = post.tradeType === 'give' || post.tradeType === 'Cho tặng';
    const isLend = post.tradeType === 'lend' || post.tradeType === 'Cho mượn';
    const isExchange = post.tradeType === 'exchange' || post.tradeType === 'Trao đổi';

    if (grade && matchesStudentGrade(grade, titleLower, descLower, post.className)) {
      score += 40;
      explanationTag = `Dành cho Khối ${grade}`;
      explanationReason = `Tài liệu và đồ dùng học tập phù hợp với chương trình học Lớp ${grade}.`;
    } else if (isGive) {
      score += 25;
      explanationTag = 'Tặng 0 đồng';
      explanationReason = 'Món đồ được bạn học tặng miễn phí để hỗ trợ cộng đồng.';
    } else if (titleLower.includes('casio') || titleLower.includes('máy tính') || descLower.includes('casio')) {
      score += 20;
      explanationTag = 'Đồ dùng thiết yếu';
      explanationReason = 'Thiết bị học tập quan trọng được nhiều học sinh tìm kiếm.';
    } else if (isLend) {
      score += 18;
      explanationTag = 'Mượn ngắn hạn';
      explanationReason = 'Học liệu cho mượn giúp tiết kiệm chi phí trong học kỳ và kỳ thi.';
    } else if (isExchange) {
      score += 15;
      explanationTag = 'Trao đổi học liệu';
      explanationReason = 'Phù hợp trao đổi trực tiếp đồ dùng học tập giữa học sinh cùng trường.';
    }

    if (typeof post.ownerReputationScore === 'number' && Number.isFinite(post.ownerReputationScore)) {
      const normalizedRep = post.ownerReputationScore > 10 ? post.ownerReputationScore / 10 : post.ownerReputationScore;
      score += Math.min(5, Math.max(0, Math.round(normalizedRep / 2)));
    }
    if (typeof post.favoriteCount === 'number' && post.favoriteCount > 0) {
      score += Math.min(3, post.favoriteCount);
    }
    if (post.hasImage) {
      score += 2;
    }

    score = Math.min(99, Math.max(10, score));

    return {
      id: post.id,
      title: post.title,
      category: post.category || 'Đồ dùng học tập',
      tradeType: post.tradeType,
      price: post.price,
      className: post.className,
      explanationTag,
      explanationReason,
      score,
    };
  }).sort((a, b) => b.score - a.score);
}

