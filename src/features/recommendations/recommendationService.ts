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

export function generateRecommendations(
  posts: Array<{
    id: string;
    title: string;
    category?: string | null;
    tradeType: string;
    price: number;
    className?: string | null;
    schoolId?: string | null;
  }>,
  studentContext?: {
    className?: string | null;
    gradeLevel?: string | null;
    schoolName?: string | null;
  }
): RecommendedPostItem[] {
  if (!posts || !posts.length) return [];

  const grade = studentContext?.gradeLevel || (studentContext?.className ? studentContext.className.match(/\d+/)?.[0] : null);

  return posts.map((post) => {
    let score = 50;
    let explanationTag = 'Gợi ý cho bạn';
    let explanationReason = 'Phù hợp với nhu cầu học tập phổ biến trong trường.';

    const titleLower = post.title.toLowerCase();

    if (grade && (titleLower.includes(`lớp ${grade}`) || titleLower.includes(`${grade}`) || (post.className && post.className.includes(grade)))) {
      score += 40;
      explanationTag = `Dành cho Khối ${grade}`;
      explanationReason = `Tài liệu và đồ dùng học tập phù hợp với chương trình học Lớp ${grade}.`;
    } else if (post.tradeType === 'give') {
      score += 25;
      explanationTag = 'Tặng 0 đồng';
      explanationReason = 'Món đồ được bạn học tặng miễn phí để hỗ trợ cộng đồng.';
    } else if (titleLower.includes('casio') || titleLower.includes('máy tính')) {
      score += 20;
      explanationTag = 'Đồ dùng thiết yếu';
      explanationReason = 'Thiết bị học tập quan trọng được nhiều học sinh tìm kiếm.';
    }

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
