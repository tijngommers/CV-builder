import { useState } from 'react';
import { CV } from './data/initialData.mts';

function App() {
  const [cvData, setCvData] = useState(CV);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <button className="download-pdf-btn" onClick={handlePrint}>
        Download als PDF
      </button>
      <main>
      <section className="basic-info">
        <section className="photo">
          <div className="photo-wrapper">
            <img src={cvData.photo} alt={`${cvData.personalInfo.name}'s photo`} />
          </div>
        </section>
        <section className="personal-info">
          <h1>{cvData.personalInfo.name}</h1>
          <p>Birthdate: {cvData.personalInfo.Birthdate}</p>
        </section>

        <section className="contact">
          <h2>Contact</h2>
          <p>Phone: {cvData.contact.phonenumber}</p>
          <p>Email: {cvData.contact.email}</p>
          <p>Address: {cvData.contact.adress}</p>
        </section>

        <section className="skills">
        <h2>Skills</h2>
        <div>
          <h3>Programming Languages</h3>
          <ul>
            {cvData.skills.programmingLanguages.map((lang, index) => (
              <li key={index}>{lang}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Frameworks</h3>
          <ul>
            {cvData.skills.frameworks.map((framework, index) => (
              <li key={index}>{framework}</li>
            ))}
          </ul>
        </div>
        </section>

        <section className="languages">
        <h2>Languages</h2>
        <ul>
          {Object.entries(cvData.languages).map(([lang, level]) => (
            <li key={lang}>{lang}: {level}</li>
          ))}
        </ul>
        </section>

        <section className="hobbies">
          <h2>Hobbies</h2>
          <ul>
            {cvData.Hobbies.map((hobby, index) => (
              <li key={index}>{hobby}</li>
            ))}
          </ul>
        </section>

      </section>

      <section className="main-info">

        <section className="profile">
          <h2>Profile</h2>
          <p>{cvData.Profile}</p>
        </section>
        
        <section className="education">
          <h2>Education</h2>
          {Object.entries(cvData.Education).map(([period, edu]) => (
            <div key={period} className="education-item">
              <h3>{period}</h3>
              <p><strong>{edu.institution}</strong></p>
              <p>{edu.degree}</p>
            </div>
          ))}
        </section>

        <section className="work-experience">
          <h2>Work Experience</h2>
          {Object.entries(cvData.Work_experience).map(([position, work]) => (
            <div key={position} className="work-item">
              <h3>{work.period}</h3>
              <p><strong>{position}</strong> at {work.company}</p>
              <p>{work.description}</p>
            </div>
          ))}
        </section>

        <section className="hackathons">
          <h2>Hackathons</h2>
          {Object.entries(cvData.Hackathons).map(([name, hackathon]) => (
            <div key={name} className="hackathon-item">
              <h3>{name}</h3>
              <p>Date: {hackathon.date}</p>
              <p>{hackathon.description}</p>
            </div>
          ))}
        </section>

        <section className="prizes">
          <h2>Prizes</h2>
          {Object.entries(cvData.Prizes).map(([name, prize]) => (
            <div key={name} className="prize-item">
              <h3>{name}</h3>
              <p>Date: {prize.date}</p>
              <p>{prize.description}</p>
            </div>
          ))}
        </section>

        <section className="degrees">
          <h2>Degrees & Certifications</h2>
          {Object.entries(cvData.Degrees).map(([name, degree]) => (
            <div key={name} className="degree-item">
              <h3>{name}</h3>
              <p><strong>{degree.organization}</strong></p>
              <p>{degree.degree}</p>
              <p>Date: {degree.date}</p>
            </div>
          ))}
        </section>

      </section>
    </main>
    </>
  );
}

export default App;