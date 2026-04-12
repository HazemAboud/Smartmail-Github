# SmartMail

SmartMail is an intelligent email aggregation app that connects to your Gmail account and uses Natural Language Processing (NLP) to automatically categorize your emails besed on custom defined categories.

## 🚀 Features

- **Secure Authentication**: User registration and login system with password hashing 
- **Gmail Integration**: Secure OAuth2 connection to the Gmail API using Authlib.
- **Custom Categories**: Users can define their own email categories and manage them through the dashboard.
- **AI Classification**: Email categorization using the `sentence-transformers` library. It uses the `all-MiniLM-L6-v2` model to perform semantic similarity analysis between email content and categories.

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask (Python)
- **Database**: MySQL (with Connection Pooling)
- **Authentication**: OAuth2 (Authlib) & Custom Session-based auth
- **Machine Learning**: Sentence-Transformers (all-MiniLM-L6-v2)
- **APIs**: Google API Library

### Frontend
- **Framework**: React (Vite)
- **Styling**: Bootstrap 5
