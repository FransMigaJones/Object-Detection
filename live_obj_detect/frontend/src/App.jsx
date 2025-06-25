import React, { useState, useEffect } from "react";

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadResults, setUploadResults] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("http://localhost:8000/detections")
        .then((res) => res.json())
        .then((data) => {
          setDetectedObjects(data.detected_objects);
        })
        .catch((e) => console.error("Failed to fetch detections", e));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadPreview(URL.createObjectURL(file));
    setUploadResults([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setUploadResults(data.detected || []);
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Segoe UI, sans-serif", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center", color: "#1e293b", fontSize: "2.5rem", marginBottom: "30px" }}>
         Live Object Detection
      </h1>

      {!isLoaded && <p style={{ textAlign: "center", color: "#64748b" }}>Loading video stream...</p>}

      <div style={{ textAlign: "center" }}>
        <img
          src="http://localhost:8000/video?width=640&height=480"
          alt="Live Object Detection Stream"
          onLoad={() => setIsLoaded(true)}
          onError={() => alert("Failed to load video stream")}
          style={{ width: "640px", maxWidth: "100%", borderRadius: "12px", border: "4px solid #94a3b8", boxShadow: "0 0 20px rgba(0,0,0,0.2)" }}
        />
      </div>

      <div style={{ marginTop: "40px", maxWidth: "640px", margin: "auto", backgroundColor: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <h3 style={{ marginBottom: "10px", color: "#1e293b" }}> Detected Objects (All time)</h3>
        {detectedObjects.length === 0 ? (
          <p style={{ color: "#64748b" }}>No objects detected yet.</p>
        ) : (
          <ul style={{ paddingLeft: "20px", color: "#334155" }}>
            {detectedObjects.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Upload Section */}
      <div style={{ marginTop: "40px", maxWidth: "640px", margin: "40px auto 0", backgroundColor: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <h3 style={{ color: "#1e293b", marginBottom: "10px" }}> Upload Image for Detection</h3>
        <input type="file" accept="image/*" onChange={handleFileUpload} style={{ marginBottom: "10px" }} />

        {uploadPreview && (
          <div style={{ marginTop: "20px" }}>
            <img src={uploadPreview} alt="Uploaded Preview" style={{ width: "100%", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
          </div>
        )}

        {uploadResults.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h4 style={{ color: "#334155" }}>Detected in Image:</h4>
            <ul style={{ paddingLeft: "20px", color: "#475569" }}>
              {uploadResults.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
