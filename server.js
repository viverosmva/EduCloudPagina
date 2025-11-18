// server.js
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Servir archivos subidos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

function slugify(str) {
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-zA-Z0-9\-_\s]/g, "")               // quitar raros
    .trim()
    .replace(/\s+/g, "-")                             // espacios a guion
    .toLowerCase();
}

app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }

    const { nombre, carrera, semestre, asignatura } = req.body || {};
    if (!nombre || !carrera || !semestre || !asignatura) {
      return res.status(400).json({ error: "Faltan campos: nombre, carrera, semestre o asignatura" });
    }

    const file = req.files.file;

    // Validar extensión PDF
    if (!/\.pdf$/i.test(file.name)) {
      return res.status(400).json({ error: "El archivo debe ser PDF" });
    }

    // Normalizar/asegurar ruta destino
    const carreraSlug = slugify(carrera);
    const semestreSlug = slugify(semestre);
    const asignaturaSlug = slugify(asignatura);
    const nombreSlug = slugify(nombre);

    const folder = path.join(__dirname, "uploads", carreraSlug, `semestre-${semestreSlug}`, asignaturaSlug);
    fs.mkdirSync(folder, { recursive: true });

    const fileName = `${nombreSlug}.pdf`;
    const finalPath = path.join(folder, fileName);

    // mover/guardar
    await file.mv(finalPath);

    // Simulación IA (dev)
    const fakeAIResponse = {
      resumen: "Resumen simulado del PDF. La IA detecta los puntos clave y los resume.",
      flashcards: [
        { pregunta: "¿Cuál es el tema principal?", respuesta: "Aplicación de IA en educación." },
        { pregunta: "Beneficio clave de la IA", respuesta: "Personalización del aprendizaje." },
      ],
      examen: [
        { pregunta: "La IA permite:", opciones: ["Personalizar", "Desordenar", "Quitar tareas"], correcta: 0 },
        { pregunta: "¿Qué requiere la IA?", opciones: ["Datos y modelos", "Suerte", "Nada"], correcta: 0 },
      ],
    };

    const publicUrl = `/uploads/${carreraSlug}/semestre-${semestreSlug}/${asignaturaSlug}/${fileName}`.replace(/\\/g, "/");

    res.json({
      mensaje: "Archivo recibido y guardado correctamente",
      storage: {
        storedPath: finalPath,
        publicUrl: publicUrl,
      },
      resultados: fakeAIResponse,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al procesar el archivo" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor EduCloud IA activo en http://localhost:${PORT}`);
});
const pdfParse = require("pdf-parse");
const axios = require("axios");

// ✅ Listar archivos subidos
app.get("/files", (req, res) => {
  const baseDir = path.join(__dirname, "uploads");
  let list = [];

  function scan(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) scan(full);
      else if (item.endsWith(".pdf"))
        list.push({ name: item, path: full.replace(__dirname, "").replace(/\\/g, "/") });
    });
  }

  if (fs.existsSync(baseDir)) scan(baseDir);
  res.json(list);
});

// ✅ Generar flashcards con IA gratuita (usa Gemini)
app.post("/generate-flashcards", async (req, res) => {
  try {
    const { file } = req.body;
    const filePath = path.join(__dirname, file);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text.slice(0, 3000); // limitamos texto

    // Llama a Gemini (Google AI)
    const prompt = `Genera 5 flashcards de estudio en español basadas en el siguiente texto:\n\n${text}\n\nDevuélvelas en formato JSON con "pregunta" y "respuesta".`;

    const geminiKey = process.env.GEMINI_API_KEY; // la obtienes en aistudio.google.com
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + geminiKey,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const flashcards = JSON.parse(aiText);

    res.json({ flashcards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error generando flashcards con IA." });
  }
});
