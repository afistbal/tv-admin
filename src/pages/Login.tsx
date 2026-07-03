import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App, Button, ConfigProvider, Divider, Form, Input, Space, Spin } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/AuthContext";
import { apiPostJson } from "@/api/client";
import { emailVerify } from "@/lib/emailVerify";
import styles from "./Login.module.css";

type EmailForm = { email: string; code: string };

/** 登录页字号与控件高度（相对上一版整体约缩小 20%，数值取整） */
const loginTheme = {
  token: {
    fontSize: 15,
    fontSizeLG: 17,
    fontSizeXL: 18,
    controlHeightLG: 45,
    lineHeight: 1.55,
  },
  components: {
    Button: {
      fontSizeLG: 17,
      controlHeightLG: 45,
      paddingBlockLG: 13,
      paddingInlineLG: 18,
    },
    Input: {
      fontSizeLG: 17,
      paddingBlockLG: 12,
      paddingInlineLG: 13,
    },
    Form: {
      labelFontSize: 16,
      verticalLabelPadding: "0 0 4px",
    },
    Divider: {
      fontSize: 15,
    },
  },
};

export function Login() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, bootstrapping, revalidateSession, loginWithEmailCode, loginWithGooglePopup, clearSessionForSiteSwitch } = useAuth();
  const loginRetryRef = useRef(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [emailForm] = Form.useForm<EmailForm>();
  const [codeSeconds, setCodeSeconds] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const codeTimerRef = useRef<number | null>(null);

  const clearCodeTimer = () => {
    if (codeTimerRef.current !== null) {
      window.clearInterval(codeTimerRef.current);
      codeTimerRef.current = null;
    }
  };

  const startCodeCountdown = (seconds: number) => {
    clearCodeTimer();
    let left = seconds;
    setCodeSeconds(left);
    codeTimerRef.current = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearCodeTimer();
        setCodeSeconds(0);
      } else {
        setCodeSeconds(left);
      }
    }, 1000);
  };

  useEffect(() => {
    if (!bootstrapping && user) {
      loginRetryRef.current = false;
      navigate(from, { replace: true });
    }
  }, [bootstrapping, user, navigate, from]);

  /** 首屏 bootstrap 若遇网络/非 JSON 未写入 user，但 token 仍在，则再请求一次 login/token */
  useEffect(() => {
    if (bootstrapping || user) {
      return;
    }
    const t = localStorage.getItem("token");
    if (!t || loginRetryRef.current) {
      return;
    }
    loginRetryRef.current = true;
    void revalidateSession();
  }, [bootstrapping, user, revalidateSession]);

  useEffect(() => () => clearCodeTimer(), []);

  const sendEmailCode = async () => {
    const em = (emailForm.getFieldValue("email") as string | undefined)?.trim() ?? "";
    if (!emailVerify(em)) {
      message.error("请先填写有效邮箱");
      return;
    }
    if (codeSeconds > 0) {
      return;
    }
    try {
      const result = await apiPostJson("login/email/code", { email: em });
      if (result.c !== 0) {
        clearSessionForSiteSwitch();
        message.error(result.m || "发送失败");
        return;
      }
      message.success("验证码已发送");
      localStorage.setItem("mail-code-expire", String(Date.now() + 60_000));
      startCodeCountdown(60);
    } catch {
      message.error("网络异常");
    }
  };

  const onEmailFinish = async (v: EmailForm) => {
    if (!emailVerify(v.email)) {
      message.error("邮箱格式不正确");
      return;
    }
    if (!/[0-9]{6}/.test(v.code.trim())) {
      message.error("请输入 6 位数字验证码");
      return;
    }
    const res = await loginWithEmailCode(v.email, v.code);
    if (!res.ok) {
      message.error(res.message);
      return;
    }
    message.success("登录成功");
    navigate(from, { replace: true });
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      const res = await loginWithGooglePopup();
      if (!res.ok) {
        message.error(res.message);
        return;
      }
      message.success("登录成功");
      navigate(from, { replace: true });
    } finally {
      setGoogleLoading(false);
    }
  };

  if (bootstrapping) {
    return (
      <ConfigProvider theme={loginTheme}>
        <div className={styles.pageLoading}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={loginTheme}>
      <div className={styles.page}>
        <div className={styles.login}>
          <h2 className={styles.title}>管理端</h2>
          <Form<EmailForm>
            id="tv-admin-login-form"
            form={emailForm}
            className={styles.form}
            layout="horizontal"
            size="large"
            labelCol={{ flex: "83px" }}
            wrapperCol={{ flex: "1" }}
            colon={false}
            onFinish={onEmailFinish}
            requiredMark={false}
          >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: "请输入邮箱" }]}
          >
            <Input placeholder="请输入邮箱" autoComplete="email" maxLength={128} />
          </Form.Item>
          <Form.Item label="验证码" required>
            <Space.Compact className={styles.codeCompact} block>
              <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                <Input placeholder="请输入验证码" maxLength={6} style={{ width: "100%" }} />
              </Form.Item>
              <Button type="default" size="large" disabled={codeSeconds > 0} onClick={() => void sendEmailCode()}>
                {codeSeconds > 0 ? `${codeSeconds}s` : "获取验证码"}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
        <div className={styles.submitWrap}>
          <Button type="primary" htmlType="submit" form="tv-admin-login-form" size="large">
            登录
          </Button>
        </div>

        <Divider plain className={styles.divider}>
          或
        </Divider>

        <Button
          type="default"
          size="large"
          icon={<GoogleOutlined className={styles.googleIcon} />}
          className={styles.googleBtn}
          loading={googleLoading}
          onClick={() => void onGoogle()}
        >
          Google 登录
        </Button>
        </div>
      </div>
    </ConfigProvider>
  );
}
