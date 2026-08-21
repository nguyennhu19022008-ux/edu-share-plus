import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseProfilePrivacyResponse,
  parseStudentProfileView,
} from '../src/features/profile/profileReadModel';

const baseInput = {
  authUser: {
    email:'student@example.test',
    created_at:'2026-08-01T01:00:00.000Z',
    last_sign_in_at:'2026-08-21T02:30:00.000Z',
  },
  profile: {
    full_name:'Nguyễn Văn A',
    class_id:'11111111-1111-4111-8111-111111111111',
    avatar_file_id:null,
    show_name:true,
    show_class:false,
    reputation_score_cache:7.5,
    reputation_label_cache:'Uy tín tốt',
    created_at:'2026-08-01T01:00:00.000Z',
    updated_at:'2026-08-20T12:45:00.000Z',
  },
  privateProfile: {
    contact_email:'private@example.test',
    phone:'0905000001',
    show_email:false,
    show_phone:true,
    face_file_id:null,
    updated_at:'2026-08-20T12:45:00.000Z',
  },
  classLabel:'11A1',
};

test('maps real self profile rows without inventing activity or image URLs', () => {
  const view = parseStudentProfileView(baseInput);

  assert.deepEqual(view, {
    email:'student@example.test',
    name:'Nguyễn Văn A',
    className:'11A1',
    phone:'0905000001',
    phoneMasked:'09•• ••• 001',
    avatarUrl:'',
    faceUrl:'',
    createdAt:'01/08/2026 08:00',
    lastLogin:'21/08/2026 09:30',
    updatedAt:'20/08/2026 19:45',
    passwordStatus:'Được quản lý bởi Supabase Auth',
    privacy:{ showName:true, showClass:false, showEmail:false, showPhone:true },
    reputation:{ score:7.5, label:'Uy tín tốt' },
  });
  assert.equal('activity' in view, false);
  assert.equal('detail' in view.reputation, false);
});

test('uses safe class and last-login fallbacks without fabricating values', () => {
  const view = parseStudentProfileView({
    ...baseInput,
    authUser:{ ...baseInput.authUser, last_sign_in_at:null },
    profile:{ ...baseInput.profile, class_id:null },
    privateProfile:{ ...baseInput.privateProfile, phone:null, contact_email:null },
    classLabel:null,
  });

  assert.equal(view.className, 'Chưa cập nhật');
  assert.equal(view.lastLogin, 'Chưa có dữ liệu');
  assert.equal(view.phone, '');
  assert.equal(view.phoneMasked, '');
  assert.equal(view.email, 'student@example.test', 'Auth email is canonical for the signed-in account');
});

test('parses the trusted privacy RPC response exactly', () => {
  assert.deepEqual(parseProfilePrivacyResponse({
    showName:false,
    showClass:true,
    showEmail:true,
    showPhone:false,
  }), {
    showName:false,
    showClass:true,
    showEmail:true,
    showPhone:false,
  });
});

test('rejects malformed profile rows and malformed privacy responses', () => {
  assert.throws(
    () => parseStudentProfileView({
      ...baseInput,
      profile:{ ...baseInput.profile, show_name:'yes' },
    }),
    /PROFILE_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseProfilePrivacyResponse({
      showName:true,
      showClass:true,
      showEmail:false,
      showPhone:'false',
    }),
    /PROFILE_RESPONSE_INVALID/,
  );
});
