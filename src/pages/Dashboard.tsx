import { Card, Col, Row, Statistic } from "antd";
import { ArrowUpOutlined } from "@ant-design/icons";

export function Dashboard() {
  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="今日访问" value={1128} prefix={<ArrowUpOutlined />} valueStyle={{ color: "#3f8600" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="在线设备" value={93} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="待处理任务" value={5} valueStyle={{ color: "#cf1322" }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
