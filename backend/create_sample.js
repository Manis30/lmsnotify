const XLSX = require("xlsx");
const path = require("path");

const sampleData = [
  { Name: "Arun", Email: "arun@gmail.com" },
  { Name: "Kumar", Email: "kumar@gmail.com" },
  { Name: "Priya", Email: "priya@gmail.com" },
  { Name: "Ravi", Email: "ravi@gmail.com" },
  { Name: "Invalid User", Email: "invalid-email-address" },
  { Name: "Missing Email", Email: "" }
];

const worksheet = XLSX.utils.json_to_sheet(sampleData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

const outputPath = path.join(__dirname, "sample_students.xlsx");
XLSX.writeFile(workbook, outputPath);

console.log("Sample Excel file created successfully at:", outputPath);
