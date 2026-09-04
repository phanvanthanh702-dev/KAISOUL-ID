const API_BASE = "http://localhost:3000/api";

const authScreen = document.getElementById("authScreen");
const profileScreen = document.getElementById("profileScreen");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const showRegisterButton = document.getElementById("showRegister");
const showLoginButton = document.getElementById("showLogin");
const forgotPasswordButton = document.getElementById("forgotPassword");
const logoutButton = document.getElementById("logoutButton");

const accountButton = document.getElementById("accountButton");

const loginIdentifier = document.getElementById("loginIdentifier");
const loginPassword = document.getElementById("loginPassword");

const registerName = document.getElementById("registerName");
const registerUsername = document.getElementById("registerUsername");
const registerPassword = document.getElementById("registerPassword");
const registerConfirmPassword =
  document.getElementById("registerConfirmPassword");
const registerContact = document.getElementById("registerContact");

const contactHint = document.getElementById("contactHint");
const generatedKaisoulId =
  document.getElementById("generatedKaisoulId");

const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileKaisoulId =
  document.getElementById("profileKaisoulId");
const profileBio = document.getElementById("profileBio");
const profileDate = document.getElementById("profileDate");

const avatarDefault = document.getElementById("avatarDefault");
const avatarImage = document.getElementById("avatarImage");

const messageBox = document.getElementById("message");


/* =========================
   MESSAGE
========================= */

function showMessage(message, type = "error") {
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = `message ${type}`;

  clearTimeout(showMessage.timer);

  showMessage.timer = setTimeout(() => {
    messageBox.textContent = "";
    messageBox.className = "message hidden";
  }, 5000);
}


/* =========================
   SCREEN
========================= */

function showAuth() {
  authScreen.classList.remove("hidden");
  profileScreen.classList.add("hidden");
}

function showProfile() {
  authScreen.classList.add("hidden");
  profileScreen.classList.remove("hidden");
}


/* =========================
   API
========================= */

async function apiRequest(endpoint, options = {}) {
  const config = {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    config
  );

  const contentType =
    response.headers.get("content-type") || "";

  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    throw new Error(
      `Server trả về dữ liệu không hợp lệ (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message || "Có lỗi xảy ra."
    );
  }

  return data;
}


/* =========================
   USERNAME
========================= */

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


/* =========================
   CONTACT
========================= */

function validateContact(value) {
  const contact = String(value || "").trim();

  const email =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const phone =
    /^\+?[0-9]{8,15}$/;

  return email.test(contact) || phone.test(contact);
}

function updateContactHint() {
  const value = registerContact.value.trim();

  if (!value) {
    contactHint.textContent =
      "Nhập email hoặc số điện thoại.";
    return;
  }

  const email =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const phone =
    /^\+?[0-9]{8,15}$/;

  if (email.test(value)) {
    contactHint.textContent =
      "Đang sử dụng email.";
  } else if (phone.test(value)) {
    contactHint.textContent =
      "Đang sử dụng số điện thoại.";
  } else {
    contactHint.textContent =
      "Email hoặc số điện thoại không hợp lệ.";
  }
}


/* =========================
   REGISTER
========================= */

registerForm.addEventListener(
  "submit",
  async (event) => {
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

    if (!displayName) {
      showMessage(
        "Vui lòng nhập tên hiển thị."
      );
      registerName.focus();
      return;
    }

    if (!/^[a-z0-9._]{3,30}$/.test(username)) {
      showMessage(
        "Username phải có 3–30 ký tự và chỉ gồm chữ thường, số, dấu chấm hoặc dấu gạch dưới."
      );
      registerUsername.focus();
      return;
    }

    if (password.length < 8) {
      showMessage(
        "Mật khẩu phải có ít nhất 8 ký tự."
      );
      registerPassword.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "Mật khẩu xác nhận không khớp."
      );
      registerConfirmPassword.focus();
      return;
    }

    if (!validateContact(contact)) {
      showMessage(
        "Email hoặc số điện thoại không hợp lệ."
      );
      registerContact.focus();
      return;
    }

    const submitButton =
      registerForm.querySelector(
        'button[type="submit"]'
      );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        "Đang tạo tài khoản...";
    }

    try {
      const result = await apiRequest(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            displayName,
            username,
            password,
            confirmPassword,
            contact
          })
        }
      );

      showMessage(
        "Tạo tài khoản thành công.",
        "success"
      );

      registerForm.reset();

      generatedKaisoulId.textContent =
        result.user.kaisoul_id;

      loadProfile(result.user);

      showProfile();
    } catch (error) {
      showMessage(
        error.message ||
          "Không thể tạo tài khoản."
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent =
          "Tạo tài khoản";
      }
    }
  }
);


/* =========================
   LOGIN
========================= */

loginForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const identifier =
      loginIdentifier.value.trim();

    const password =
      loginPassword.value;

    if (!identifier || !password) {
      showMessage(
        "Vui lòng nhập username/email/số điện thoại và mật khẩu."
      );
      return;
    }

    const submitButton =
      loginForm.querySelector(
        'button[type="submit"]'
      );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        "Đang đăng nhập...";
    }

    try {
      const result = await apiRequest(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            identifier,
            password
          })
        }
      );

      loginForm.reset();

      loadProfile(result.user);

      showProfile();

      showMessage(
        "Đăng nhập thành công.",
        "success"
      );
    } catch (error) {
      showMessage(
        error.message ||
          "Đăng nhập thất bại."
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent =
          "Đăng nhập";
      }
    }
  }
);


/* =========================
   LOAD PROFILE
========================= */

function loadProfile(user) {
  if (!user) return;

  profileName.textContent =
    user.display_name || "";

  profileUsername.textContent =
    user.username
      ? `@${user.username}`
      : "";

  profileKaisoulId.textContent =
    user.kaisoul_id || "";

  profileBio.textContent =
    user.bio ||
    "Chưa có giới thiệu.";

  if (user.created_at) {
    const date =
      new Date(user.created_at);

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
    profileDate.textContent = "";
  }

  updateAvatar(user.avatar_url);
}


/* =========================
   AVATAR
========================= */

function updateAvatar(avatarUrl) {
  if (avatarUrl) {
    avatarImage.src = avatarUrl;
    avatarImage.classList.remove("hidden");

    avatarDefault.classList.add("hidden");
  } else {
    avatarImage.removeAttribute("src");

    avatarImage.classList.add("hidden");
    avatarDefault.classList.remove("hidden");
  }
}


/* =========================
   LOGOUT
========================= */

logoutButton.addEventListener(
  "click",
  async () => {
    try {
      await apiRequest(
        "/auth/logout",
        {
          method: "POST"
        }
      );

      showAuth();

      showMessage(
        "Đã đăng xuất.",
        "success"
      );
    } catch (error) {
      showMessage(
        error.message ||
          "Không thể đăng xuất."
      );
    }
  }
);


/* =========================
   NAVIGATION
========================= */

showRegisterButton.addEventListener(
  "click",
  () => {
    document
      .getElementById("loginPanel")
      ?.classList.add("hidden");

    document
      .getElementById("registerPanel")
      ?.classList.remove("hidden");

    generatedKaisoulId.textContent =
      "KAISOUL ID sẽ được cấp tự động";
  }
);

showLoginButton.addEventListener(
  "click",
  () => {
    document
      .getElementById("registerPanel")
      ?.classList.add("hidden");

    document
      .getElementById("loginPanel")
      ?.classList.remove("hidden");
  }
);


/* =========================
   FORGOT PASSWORD
========================= */

forgotPasswordButton.addEventListener(
  "click",
  () => {
    showMessage(
      "Chức năng khôi phục mật khẩu sẽ được kết nối ở bước Password Reset.",
      "info"
    );
  }
);


/* =========================
   CONTACT INPUT
========================= */

registerContact.addEventListener(
  "input",
  updateContactHint
);


/* =========================
   ACCOUNT
========================= */

accountButton.addEventListener(
  "click",
  () => {
    showMessage(
      "Trang Account sẽ được triển khai ở bước tiếp theo.",
      "info"
    );
  }
);


/* =========================
   CHECK SESSION
========================= */

async function checkSession() {
  try {
    const result =
      await apiRequest("/auth/me");

    if (result.success && result.user) {
      loadProfile(result.user);
      showProfile();
    } else {
      showAuth();
    }
  } catch {
    showAuth();
  }
}


/* =========================
   GLOBAL ERROR HANDLER
========================= */

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "KAISOUL ID error:",
      event.error || event.message
    );

    showMessage(
      "KAISOUL ID gặp lỗi. Vui lòng thử lại.",
      "error"
    );
  }
);


/* =========================
   START
========================= */

checkSession();
updateContactHint();
