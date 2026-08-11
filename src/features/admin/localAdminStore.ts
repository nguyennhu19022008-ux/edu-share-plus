import { INITIAL_ADMIN_POSTS } from './mockAdmin';
import type { AdminDashboardSummary, AdminPost, AdminPostPatch } from './types';

let posts:AdminPost[] = INITIAL_ADMIN_POSTS.map((post) => ({ ...post }));

export function getAdminPostsLocal():AdminPost[] {
  return posts.map((post) => ({ ...post }));
}

export function resetAdminPostsLocal():AdminPost[] {
  posts = INITIAL_ADMIN_POSTS.map((post) => ({ ...post }));
  return getAdminPostsLocal();
}

export function updateAdminPostLocal(id:string, patch:AdminPostPatch):AdminPost | null {
  const index = posts.findIndex((post) => post.id === id);
  if (index < 0) return null;
  posts[index] = { ...posts[index], ...patch };
  return { ...posts[index] };
}

export function approveAllPendingLocal():number {
  let count = 0;
  posts = posts.map((post) => {
    if (post.source === 'Posts' && post.status === 'Chờ duyệt') {
      count += 1;
      return { ...post, status:'Đang mở', hidden:false, rejectionReason:'' };
    }
    return post;
  });
  return count;
}

export function getAdminPostLocal(id:string):AdminPost | null {
  const post = posts.find((item) => item.id === id);
  return post ? { ...post } : null;
}

function topBy(items:string[], limit=4):Array<{name:string;count:number}> {
  const counts = new Map<string, number>();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()]
    .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
    .slice(0, limit)
    .map(([name,count]) => ({ name, count }));
}

export function getAdminDashboardSummaryLocal():AdminDashboardSummary {
  const current = posts;
  const totalPosts = current.length;
  const done = current.filter((post) => post.status === 'Đã xong').length;
  const pending = current.filter((post) => post.status === 'Chờ duyệt').length;
  const reports = current.reduce((sum, post) => sum + Number(post.reportCount || 0), 0);
  const approvedPosts = current.filter((post) => post.status === 'Đang mở' || post.status === 'Đã xong').length;
  const financialSaved = current
    .filter((post) => post.status === 'Đã xong')
    .reduce((sum, post) => sum + (post.tradeType === 'Bán giá rẻ' ? Math.max(0, Math.round(post.price * .35)) : 55000), 0);
  const wasteReducedKg = Number((done * .42).toFixed(1));

  return {
    totalPosts,
    done,
    pending,
    reports,
    approvalRate:totalPosts ? Math.round((approvedPosts / totalPosts) * 1000) / 10 : 0,
    completionRate:totalPosts ? Math.round((done / totalPosts) * 1000) / 10 : 0,
    reportRate:totalPosts ? Math.round((current.filter((post) => post.reportCount > 0).length / totalPosts) * 1000) / 10 : 0,
    topCategories:topBy(current.map((post) => post.category)),
    topClasses:topBy(current.map((post) => post.className)),
    financialSaved,
    wasteReducedKg,
    updatedAt:new Date().toLocaleString('vi-VN'),
  };
}
