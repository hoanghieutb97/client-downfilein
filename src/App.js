import React, { useState, useRef } from "react";
import axios from "axios";
import { Button, Input, Tree, message, Spin, Radio } from "antd";

const SERVERS = {
  "TRUNG VĂN": "http://101.99.6.103:7000",
  "SÓC SƠN": "http://210.245.53.96:7000"
};

function App() {
  const [selectedSite, setSelectedSite] = useState("TRUNG VĂN");
  const [rootPath, setRootPath] = useState("");
  const [treeData, setTreeData] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [loadedMB, setLoadedMB] = useState(0);
  const [speed, setSpeed] = useState(0);
  const speedRef = useRef({ lastLoaded: 0, lastTime: Date.now() });

  // Phân loại icon cho từng loại file
  const getIcon = (name, isDir) => {
    if (isDir) return "📁";
    const ext = name.toLowerCase().split(".").pop();
    if (ext === "tif") return "🖼️";
    if (ext === "dxf") return "🖨️";
    if (ext === "cdr") return "✂️";
    return "📄";
  };

  // Lấy danh sách file/folder con từ đúng server
  const fetchChildren = async (path) => {
    try {
      const res = await axios.get(`${SERVERS[selectedSite]}/list-folder`, {
        params: { path }
      });
      return res.data.map(item => ({
        title: `${getIcon(item.name, item.isDir)} ${item.name}`,
        key: path.endsWith("\\") ? path + item.name : path + "\\" + item.name,
        isLeaf: !item.isDir
      }));
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        message.error(err.response.data.error); // Show đúng message BE trả về
      } else {
        message.error("Không đọc được thư mục!");
      }
      return [];
    }
  };

  // Load thư mục gốc
  const loadRoot = async (value) => {
    setDownloadDone(false);
    setLoadingTree(true);

    // Nếu value bắt đầu bằng đúng 1 dấu "\" thì đổi thành "\\"
    let fixedPath = value;
    if (/^\\[^\\]/.test(value)) {
      fixedPath = "\\" + value; // thêm 1 dấu \ nữa ở đầu
    }
    setRootPath(fixedPath);
    setCheckedKeys([]);
    const children = await fetchChildren(fixedPath);
    setTreeData([{
      title: `📁 ${fixedPath}`,
      key: fixedPath,
      children,
      selectable: false,
    }]);
    setLoadingTree(false);
  };

  // Update tree khi load node con (chuẩn AntD)
  const updateTreeData = (list, key, children) =>
    list.map(node => {
      if (node.key === key) return { ...node, children };
      if (node.children) return { ...node, children: updateTreeData(node.children, key, children) };
      return node;
    });

  // Xử lý mở rộng node
  const onLoadData = async (treeNode) => {
    if (treeNode.children) return;
    const children = await fetchChildren(treeNode.key);
    setTreeData(origin => updateTreeData(origin, treeNode.key, children));
  };

  // Tải file ZIP
  const handleDownload = async () => {
    if (checkedKeys.length === 0) {
      message.warning("Chọn file/thư mục muốn tải!");
      return;
    }
    setIsDownloading(true);
    setLoadedMB(0);
    setSpeed(0);
    setDownloadDone(false);
    speedRef.current = { lastLoaded: 0, lastTime: Date.now() };

    try {
      console.log(`${SERVERS["TRUNG VĂN"]}/download-zip-treeee`);
      
      const res = await axios.post(`${SERVERS["TRUNG VĂN"]}/zip-and-send-lark`, {
        selected: checkedKeys,
        rootPath,
      });

      // ✅ Nhận được đường dẫn từ BE, ví dụ: /downloads/myFile.zip
      const { downloadUrl } = res.data;
      console.log(res.data);

      setDownloadDone(true);
    } catch (err) {
      message.error("Có lỗi khi tải file!");
    } finally {
      setIsDownloading(false);
      setLoadedMB(0);
      setSpeed(0);
    }
  };

  // Đổi server thì reset hết state liên quan
  const handleChangeSite = (site) => {
    setSelectedSite(site);
    setTreeData([]);
    setCheckedKeys([]);
    // setRootPath("");
    setDownloadDone(false);
  };

  return (
    <div style={{ maxWidth: 800, margin: "50px auto", padding: 24, position: "relative" }}>
      <Radio.Group
        value={selectedSite}
        onChange={e => handleChangeSite(e.target.value)}
        style={{
          marginBottom: 16,
          fontWeight: 600,
          fontSize: 18,
          fontFamily: "'Inter', 'Roboto', Arial, sans-serif"
        }}
        buttonStyle="solid"
        disabled={isDownloading} // Thêm nếu muốn khóa khi đang tải, hoặc bỏ đi luôn
      >
        <Radio.Button value="TRUNG VĂN">TRUNG VĂN</Radio.Button>
        <Radio.Button value="SÓC SƠN">SÓC SƠN</Radio.Button>
      </Radio.Group>


      <Input.Search
        placeholder="Nhập đường dẫn thư mục gốc"
        enterButton="Xem"
        value={rootPath}
        onChange={e => setRootPath(e.target.value)}
        onSearch={loadRoot}
        style={{ marginBottom: 16 }}
        disabled={isDownloading}
      />

      <div
        style={{
          pointerEvents: isDownloading ? "none" : "auto",
          opacity: isDownloading ? 0.3 : 1,
          transition: "opacity 0.2s"
        }}
      >
        {loadingTree ? (
          <Spin tip="Đang load thư mục..."><div style={{ height: 80 }} /></Spin>
        ) : (
          <Tree
            checkable
            loadData={onLoadData}
            treeData={treeData}
            checkedKeys={checkedKeys}
            onCheck={setCheckedKeys}
          />
        )}

        <Button
          type="primary"
          onClick={handleDownload}
          disabled={checkedKeys.length === 0 || isDownloading}
          style={{ marginBottom: 24 }}
        >
          OK - Tải về ZIP
        </Button>
      </div>

      {isDownloading && (
        <div
          style={{
            position: "absolute",
            top: "35%",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 10,
            fontWeight: "bold",
            fontSize: 36,
            color: "#1677ff",
            background: "rgba(255,255,255,0.95)",
            padding: 32,
            borderRadius: 18,
            boxShadow: "0 0 16px 2px #1677ff44"
          }}
        >
          Đang tải...- nếu hộp thoại này mãi không mất thì bị lỗi, không cần phải tải tiếp !
          <br />
          {/* <span style={{ fontSize: 52, color: "#111" }}>
            {speed.toFixed(2)} MB/s
          </span> */}
          <br />
          {/* <span style={{ fontSize: 30, color: "#444" }}>
            Đã tải {loadedMB} MB
          </span> */}
        </div>
      )}

      {downloadDone && !isDownloading && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 0,
            width: "100vw",
            textAlign: "center",
            zIndex: 999,
            fontSize: 32,
            fontWeight: "bold",
            color: "#06c850"
          }}
        >
          🎉 Đã tải xong!
        </div>
      )}
    </div>
  );
}

export default App;
