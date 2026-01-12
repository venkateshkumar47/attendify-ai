
import { GoogleGenAI, Type } from "@google/genai";
import { Student, AttendanceRecord } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const getAttendanceInsights = async (students: Student[], records: AttendanceRecord[]) => {
  const ai = getAIClient();
  
  // Prepare a summarized view for the AI
  const summary = students.map(s => {
    const studentRecords = records.filter(r => r.studentId === s.id);
    const absentCount = studentRecords.filter(r => r.status === 'Absent').length;
    return { name: s.name, grade: s.grade, absences: absentCount };
  });

  const prompt = `
    Analyze this attendance data for the current month:
    ${JSON.stringify(summary)}

    Identify:
    1. The most irregular student (highest absences).
    2. Any attendance trends.
    3. A brief recommendation for the admin.
    
    Format the response as clear, professional advice.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at this moment. Please check student records manually.";
  }
};

export const generateNotificationEmail = async (student: Student, absences: number) => {
  const ai = getAIClient();
  const prompt = `
    Write a professional and supportive email to a student named ${student.name} who has missed ${absences} days of school this month. 
    The tone should be encouraging but firm about the importance of attendance. 
    Include a placeholder for the school name and principal's signature.
    Return only the subject line and the body of the email.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Email Error:", error);
    return `Subject: Attendance Concern - ${student.name}\n\nDear ${student.name},\n\nWe noticed you have missed ${absences} days this month. Please contact the office to discuss this.`;
  }
};
