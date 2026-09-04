"use strict";

/*
  KAISOUL ID v1
  Frontend prototype

  Lưu ý:
  - Đây chỉ là prototype.
  - Không lưu mật khẩu thật trong localStorage.
  - Khi có backend, login/register phải chuyển sang API.
*/


/* =========================================================
   DOM
========================================================= */

const authScreen = document.getElementById("authScreen");
const profileScreen = document.getElementById("profileScreen");

const loginPage = document.getElementById("loginPage");
const registerPage = document.getElementById("registerPage");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const showRegisterBtn = document.getElementById("showRegisterBtn");
const backLoginBtn = document.getElementById("backLoginBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");
const accountBtn = document.getElementById("accountBtn");

const generatedKaisoulId =
  document.getElementById("generatedKaisoulId");

const message =
  document.getElementById("message");

const registerUsername =
  document.getElementById("registerUsername");

const registerPassword =
  document.getElementById("registerPassword");

const registerConfirmPassword =
  document.getElementById("registerConfirmPassword");

const registerName =
  document.getElementById("registerName");

const registerContact =
  document.getElementById("registerContact");

const avatarDefault =
  document.getElementById("avatarDefault");

const avatarImage =
  document.getElementById("avatarImage");

const profileName =
  document.getElementById("profileName");

const profileUsername =
  document.getElementById("profileUsername");

const profileKaisoulId =
  document.getElementById("profileKaisoulId");

const profileBio =
  document.getElementById("profileBio");

const profileDate =
  document.getElementById("profileDate");


/* =========================================================
   CONFIG
========================================================= */

const STORAGE_KEY = "kaisoul_id_prototype_user";
const SESSION_KEY = "kaisoul_id_prototype_session";


/* =========================================================
   UTILITY
========================================================= */

function showMessage(text) {
  if (!message) return;

  message.textContent = text;
  message.classList.remove("hidden");

  clearTimeout(showMessage.timer);

  showMessage.timer = setTimeout(() => {
    message.classList.add("hidden");
  }, 3000);
}


function showLogin() {
  loginPage.classList.remove("hidden");
  registerPage.classList.add("hidden");
}


function showRegister() {
  loginPage.classList.add("hidden");
  registerPage.classList.remove("hidden");
}


function showProfile() {
  authScreen.classList.add("hidden");
  profileScreen.classList.remove("hidden");
}


function showAuth() {
  profileScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
}


function normalizeUsername(value) {
  return value
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}


function isValidUsername(username) {
  return /^[a-z0-9._]{3,30}$/.test(username);
}


function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}


function isPhone(value) {
  return /^\+?[0-9\s().-]{8,20}$/.test(value);
}


/* =========================================================
   KAISOUL ID GENERATOR
========================================================= */

/*
  Format:

  SODK-583742/001//KAISOULID

  SODK       = prefix
  583742     = random number
  001        = account sequence
  KAISOULID  = suffix
*/

function generateRandomNumber() {
  return Math.floor(
    100000 + Math.random() * 900000
  );
}


function getNextAccountNumber() {
  const current =
    Number(
      localStorage.getItem("kaisoul_account_sequence") || "0"
    );

  const next = current + 1;

  localStorage.setItem(
    "kaisoul_account_sequence",
    String(next)
  );

  return String(next).padStart(3, "0");
}


function generateKaisoulId() {
  const randomNumber =
    generateRandomNumber();

  const sequence =
    getNextAccountNumber();

  return `SODK-${randomNumber}/${sequence}//KAISOULID`;
}


/* =========================================================
   PREVIEW KAISOUL ID
========================================================= */

function updateKaisoulIdPreview() {

  if (!generatedKaisoulId) return;

  const previewRandom =
    String(generateRandomNumber());

  generatedKaisoulId.textContent =
    `SODK-${previewRandom}/001//KAISOULID`;
}


/* =========================================================
   REGISTER
========================================================= */

registerForm.addEventListener(
  "submit",
  function (event) {

    event.preventDefault();

    const displayName =
      registerName.value.trim();

    const username =
      normalizeUsername(registerUsername.value);

    const password =
      registerPassword.value;

    const confirmPassword =
      registerConfirmPassword.value;

    const contact =
      registerContact.value.trim();


    /* NAME */

    if (!displayName) {
      showMessage("Vui lòng nhập tên hiển thị.");
      registerName.focus();
      return;
    }


    /* USERNAME */

    if (!isValidUsername(username)) {
      showMessage(
        "Username phải có 3–30 ký tự và chỉ gồm chữ thường, số, . hoặc _."
      );

      registerUsername.focus();
      return;
    }


    /* PASSWORD */

    if (password.length < 8) {
      showMessage(
        "Mật khẩu phải có ít nhất 8 ký tự."
      );

      registerPassword.focus();
      return;
    }


    /* CONFIRM PASSWORD */

    if (password !== confirmPassword) {
      showMessage(
        "Mật khẩu xác nhận không khớp."
      );

      registerConfirmPassword.focus();
      return;
    }


    /* CONTACT */

    if (
      !isEmail(contact) &&
      !isPhone(contact)
    ) {
      showMessage(
        "Email hoặc số điện thoại không hợp lệ."
      );

      registerContact.focus();
      return;
    }


    /*
      Prototype:
      Kiểm tra tài khoản cũ.
    */

    const oldUser =
      localStorage.getItem(STORAGE_KEY);

    if (oldUser) {

      let parsed;

      try {
        parsed = JSON.parse(oldUser);
      } catch {
        parsed = null;
      }

      if (
        parsed &&
        parsed.username === username
      ) {
        showMessage(
          "Username này đã tồn tại trong prototype."
        );

        return;
      }
    }


    /* CREATE KAISOUL ID */

    const kaisoulId =
      generateKaisoulId();


    /* CREATED DATE */

    const createdAt =
      new Date().toISOString();


    /*
      Không lưu password.
      Backend thật sẽ hash password bằng Argon2id.
    */

    const user = {
      displayName,
      username,
      contact,
      kaisoulId,
      createdAt,
      bio: "",
      avatarUrl: "",
      profileVisibility: "public",
      allowUsernameSearch: true
    };


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(user)
    );


    localStorage.setItem(
      SESSION_KEY,
      "true"
    );


    showMessage(
      "Tạo KAISOUL ID thành công."
    );


    registerForm.reset();

    loadProfile();

    showProfile();
  }
);


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener(
  "submit",
  function (event) {

    event.preventDefault();

    const identifier =
      document
        .getElementById("loginIdentifier")
        .value
        .trim();

    const password =
      document
        .getElementById("loginPassword")
        .value;


    if (!identifier) {
      showMessage(
        "Vui lòng nhập Username, Email hoặc SĐT."
      );

      return;
    }


    if (!password) {
      showMessage(
        "Vui lòng nhập mật khẩu."
      );

      return;
    }


    const stored =
      localStorage.getItem(STORAGE_KEY);


    if (!stored) {
      showMessage(
        "Chưa có tài khoản trong prototype."
      );

      return;
    }


    /*
      Prototype này không lưu password.
      Vì vậy không giả lập xác thực password thật.
      Backend sẽ xử lý phần này.
    */

    let user;

    try {
      user = JSON.parse(stored);
    } catch {
      showMessage(
        "Dữ liệu tài khoản bị lỗi."
      );

      return;
    }


    const normalizedIdentifier =
      normalizeUsername(identifier);


    const matches =
      normalizedIdentifier === user.username ||
      identifier.toLowerCase() ===
        String(user.contact).toLowerCase();


    if (!matches) {
      showMessage(
        "Không tìm thấy tài khoản."
      );

      return;
    }


    localStorage.setItem(
      SESSION_KEY,
      "true"
    );


    document
      .getElementById("loginIdentifier")
      .value = "";

    document
      .getElementById("loginPassword")
      .value = "";


    loadProfile();

    showProfile();

    showMessage(
      "Đăng nhập thành công."
    );
  }
);


/* =========================================================
   REGISTER / LOGIN NAVIGATION
========================================================= */

showRegisterBtn.addEventListener(
  "click",
  function () {

    updateKaisoulIdPreview();
    showRegister();

  }
);


backLoginBtn.addEventListener(
  "click",
  function () {

    showLogin();

  }
);


/* =========================================================
   FORGOT PASSWORD
========================================================= */

forgotPasswordBtn.addEventListener(
  "click",
  function () {

    showMessage(
      "Chức năng đặt lại mật khẩu sẽ được kết nối với backend."
    );

  }
);


/* =========================================================
   LOAD PROFILE
========================================================= */

function loadProfile() {

  const stored =
    localStorage.getItem(STORAGE_KEY);

  if (!stored) return;


  let user;

  try {
    user = JSON.parse(stored);
  } catch {
    return;
  }


  profileName.textContent =
    user.displayName || "Tên hiển thị";


  profileUsername.textContent =
    `@${user.username || "username"}`;


  profileKaisoulId.textContent =
    user.kaisoulId ||
    "SODK-000000/001//KAISOULID";


  profileBio.textContent =
    user.bio ||
    "Chưa có giới thiệu.";


  if (user.createdAt) {

    const date =
      new Date(user.createdAt);

    profileDate.textContent =
      date.toLocaleDateString(
        "vi-VN",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }
      );

  } else {

    profileDate.textContent =
      "--/--/----";

  }


  /* AVATAR */

  if (user.avatarUrl) {

    avatarImage.src =
      user.avatarUrl;

    avatarImage.classList.remove(
      "hidden"
    );

    avatarDefault.classList.add(
      "hidden"
    );

  } else {

    /*
      Không có avatar:
      trở về silhouette người vô danh.
    */

    avatarImage.removeAttribute(
      "src"
    );

    avatarImage.classList.add(
      "hidden"
    );

    avatarDefault.classList.remove(
      "hidden"
    );
  }
}


/* =========================================================
   ACCOUNT BUTTON
========================================================= */

accountBtn.addEventListener(
  "click",
  function () {

    showMessage(
      "Trang quản lý tài khoản sẽ được xây dựng tiếp theo."
    );

  }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  function () {

    localStorage.removeItem(
      SESSION_KEY
    );

    showAuth();

    showLogin();

    showMessage(
      "Đã đăng xuất."
    );

  }
);


/* =========================================================
   SESSION CHECK
========================================================= */

function checkSession() {

  const session =
    localStorage.getItem(
      SESSION_KEY
    );

  const user =
    localStorage.getItem(
      STORAGE_KEY
    );


  if (
    session === "true" &&
    user
  ) {

    loadProfile();
    showProfile();

  } else {

    showAuth();
    showLogin();

  }
}


/* =========================================================
   ERROR BOUNDARY
========================================================= */

window.addEventListener(
  "error",
  function (event) {

    console.error(
      "KAISOUL ID error:",
      event.error || event.message
    );

    showMessage(
      "KAISOUL ID gặp lỗi. Kiểm tra Console để xem chi tiết."
    );

  }
);


/* =========================================================
   START
========================================================= */

checkSession();
