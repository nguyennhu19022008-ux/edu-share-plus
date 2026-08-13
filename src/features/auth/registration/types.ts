export type RegistrationSchool = {
  id: string;
  code: string;
  name: string;
};

export type StudentRegistrationInput = {
  fullName: string;
  schoolId: string;
  className: string;
  phone: string;
  email: string;
  password: string;
};
