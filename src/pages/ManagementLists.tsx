import { useMemo, useState, type ReactNode } from "react";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Empty, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import styles from "./ManagementLists.module.css";

type Row = Record<string, ReactNode> & { key: string };

type PageDefinition = {
  title: string;
  description: string;
  keywordPlaceholder: string;
  filterPlaceholder: string;
  filterOptions: { label: string; value: string }[];
  showDateRange?: boolean;
  columns: ColumnsType<Row>;
};

const definitions: Record<"users" | "visitLogs" | "guides" | "siteConfig", PageDefinition> = {
  users: {
    title: "用户列表",
    description: "查看和管理平台用户信息",
    keywordPlaceholder: "请输入用户 ID、昵称或手机号",
    filterPlaceholder: "用户状态",
    filterOptions: [
      { label: "全部状态", value: "all" },
      { label: "正常", value: "enabled" },
      { label: "已禁用", value: "disabled" },
    ],
    columns: [
      { title: "用户 ID", dataIndex: "id", width: 120 },
      { title: "用户信息", dataIndex: "user", width: 220 },
      { title: "联系方式", dataIndex: "contact", width: 180 },
      { title: "注册来源", dataIndex: "source", width: 140 },
      { title: "状态", dataIndex: "status", width: 100 },
      { title: "注册时间", dataIndex: "createdAt", width: 180 },
      { title: "最近登录", dataIndex: "lastLoginAt", width: 180 },
      { title: "操作", dataIndex: "actions", fixed: "right", width: 120 },
    ],
  },
  visitLogs: {
    title: "访问日志",
    description: "查看用户访问记录与来源信息",
    keywordPlaceholder: "请输入用户 ID、访问页面或 IP",
    filterPlaceholder: "访问类型",
    filterOptions: [
      { label: "全部类型", value: "all" },
      { label: "页面访问", value: "page" },
      { label: "接口访问", value: "api" },
    ],
    showDateRange: true,
    columns: [
      { title: "日志 ID", dataIndex: "id", width: 120 },
      { title: "用户", dataIndex: "user", width: 180 },
      { title: "访问页面", dataIndex: "page", width: 220 },
      { title: "来源", dataIndex: "source", width: 180 },
      { title: "IP 地址", dataIndex: "ip", width: 150 },
      { title: "设备信息", dataIndex: "device", width: 220 },
      { title: "访问时间", dataIndex: "visitedAt", width: 180 },
      { title: "操作", dataIndex: "actions", fixed: "right", width: 100 },
    ],
  },
  guides: {
    title: "引导列表",
    description: "管理站点内的引导内容及展示状态",
    keywordPlaceholder: "请输入引导名称或标识",
    filterPlaceholder: "展示状态",
    filterOptions: [
      { label: "全部状态", value: "all" },
      { label: "展示中", value: "enabled" },
      { label: "已停用", value: "disabled" },
    ],
    columns: [
      { title: "引导 ID", dataIndex: "id", width: 120 },
      { title: "引导名称", dataIndex: "name", width: 220 },
      { title: "展示位置", dataIndex: "position", width: 160 },
      { title: "目标页面", dataIndex: "target", width: 220 },
      { title: "排序", dataIndex: "sort", width: 100 },
      { title: "状态", dataIndex: "status", width: 100 },
      { title: "更新时间", dataIndex: "updatedAt", width: 180 },
      { title: "操作", dataIndex: "actions", fixed: "right", width: 140 },
    ],
  },
  siteConfig: {
    title: "站点配置",
    description: "维护各站点的基础配置与启用状态",
    keywordPlaceholder: "请输入站点名称、标识或域名",
    filterPlaceholder: "站点状态",
    filterOptions: [
      { label: "全部状态", value: "all" },
      { label: "已启用", value: "enabled" },
      { label: "已停用", value: "disabled" },
    ],
    columns: [
      { title: "站点 ID", dataIndex: "id", width: 120 },
      { title: "站点名称", dataIndex: "name", width: 200 },
      { title: "站点标识", dataIndex: "code", width: 150 },
      { title: "访问域名", dataIndex: "domain", width: 240 },
      { title: "默认语言", dataIndex: "language", width: 120 },
      { title: "状态", dataIndex: "status", width: 100 },
      { title: "更新时间", dataIndex: "updatedAt", width: 180 },
      { title: "操作", dataIndex: "actions", fixed: "right", width: 140 },
    ],
  },
};

function ManagementListPage({ type }: { type: keyof typeof definitions }) {
  const page = definitions[type];
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = useMemo<Row[]>(() => [], []);

  const resetFilters = () => {
    setKeyword("");
    setFilter("all");
  };

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Space size="small" align="center">
            <Typography.Title level={4} className={styles.title}>
              {page.title}
            </Typography.Title>
            <Tag color="blue">新后台</Tag>
          </Space>
          <Typography.Text type="secondary">{page.description}</Typography.Text>
        </div>
      </div>

      <Card size="small" className={styles.filterCard}>
        <div className={styles.filters}>
          <Input
            allowClear
            value={keyword}
            prefix={<SearchOutlined />}
            placeholder={page.keywordPlaceholder}
            className={styles.keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            value={filter}
            options={page.filterOptions}
            placeholder={page.filterPlaceholder}
            className={styles.select}
            onChange={setFilter}
          />
          {page.showDateRange ? (
            <DatePicker.RangePicker className={styles.dateRange} placeholder={["开始日期", "结束日期"]} />
          ) : null}
          <Space className={styles.filterActions}>
            <Button type="primary" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>
              重置
            </Button>
          </Space>
        </div>
      </Card>

      <Card size="small" className={styles.tableCard} styles={{ body: { padding: 0 } }}>
        <Table<Row>
          rowKey="key"
          columns={page.columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据，列表接口待接入" />
            ),
          }}
        />
        <div className={styles.tableFooter}>
          <Typography.Text type="secondary">共 0 条</Typography.Text>
        </div>
      </Card>
    </section>
  );
}

export function ManagementUserList() {
  return <ManagementListPage type="users" />;
}

export function ManagementVisitLogs() {
  return <ManagementListPage type="visitLogs" />;
}

export function ManagementGuideList() {
  return <ManagementListPage type="guides" />;
}

export function ManagementSiteConfig() {
  return <ManagementListPage type="siteConfig" />;
}
