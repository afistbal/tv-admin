import { Tabs, Typography } from "antd";
import { TikTokAdConfig } from "./TikTokAdConfig";
import { TikTokMinisLinkMock } from "./TikTokMinisLinkMock";

export function TikTokConfig() {
  return (
    <div>
      <Typography.Title level={4}>TikTok 配置</Typography.Title>
      <Tabs
        defaultActiveKey="minis-links"
        items={[
          {
            key: "minis-links",
            label: "Minis Link",
            children: <TikTokMinisLinkMock />,
          },
          {
            key: "ads",
            label: "TikTok 广告配置",
            children: <TikTokAdConfig />,
          },
        ]}
      />
    </div>
  );
}
