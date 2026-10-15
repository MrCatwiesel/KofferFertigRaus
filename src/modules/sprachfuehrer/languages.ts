import type { AllergenId, PhraseId } from './phrases'

/**
 * Sätze je Zielsprache (offline in der App). Höfliche Form, wo die Sprache eine kennt.
 * `english` fehlt bei Englisch (sinnlos). Griechisch hat zusätzlich eine Umschrift (`pron`).
 * Neue Sprache: Eintrag hier + Länder in LANGUAGE_OF_COUNTRY (logic.ts); der Test prüft Vollständigkeit.
 */
export interface PhraseLanguage {
  /** Stimme fürs Vorlesen (BCP 47) */
  speech: string
  phrases: Partial<Record<PhraseId, string>>
  allergens: Record<AllergenId, string>
  /** Umschrift für fremde Schriften */
  pron?: { phrases: Partial<Record<PhraseId, string>>; allergens: Record<AllergenId, string> }
}

export const LANGUAGES: Record<string, PhraseLanguage> = {
  en: {
    speech: 'en-GB',
    phrases: {
      hello: 'Hello', morning: 'Good morning', evening: 'Good evening', bye: 'Goodbye', please: 'Please', thanks: 'Thank you', thanksMuch: 'Thank you very much',
      yes: 'Yes', no: 'No', sorry: 'Excuse me', notUnderstand: 'I don’t understand.', price: 'How much is this?', toilet: 'Where is the toilet?',
      table: 'A table for two, please.', menu: 'The menu, please.', water: 'A glass of water, please.', beer: 'A beer, please.', coffee: 'A coffee, please.',
      bill: 'The bill, please.', card: 'Can I pay by card?', vegetarian: 'Do you have anything vegetarian?', delicious: 'It was delicious!',
      station: 'Where is the railway station?', ticket: 'A ticket to …, please.', open: 'When are you open?', left: 'left', right: 'right', straight: 'straight ahead',
      help: 'Help!', ambulance: 'Call an ambulance!', doctor: 'I need a doctor.', hospital: 'Where is the hospital?', pharmacy: 'Where is a pharmacy?',
      police: 'Call the police!', bloodThinner: 'I take blood thinners.', allergic: 'I am allergic to:', without: 'Please make it without these – they are dangerous for me.',
      contains: 'Does this contain any of these?',
      diabetes: 'I have diabetes.', asthma: 'I have asthma.', pacemaker: 'I have a pacemaker.', bloodType: 'Blood type:'
    },
    allergens: { peanuts: 'peanuts', nuts: 'tree nuts', gluten: 'gluten', milk: 'milk', eggs: 'eggs', fish: 'fish', shellfish: 'shellfish', soy: 'soy', sesame: 'sesame', celery: 'celery', mustard: 'mustard', penicillin: 'penicillin', lactose: 'lactose', molluscs: 'molluscs (mussels, squid)', lupin: 'lupin', sulphites: 'sulphites', kiwi: 'kiwi', strawberries: 'strawberries', tomatoes: 'tomatoes', peach: 'peach', garlic: 'garlic', onions: 'onions', corn: 'corn', coconut: 'coconut', aspirin: 'aspirin', ibuprofen: 'ibuprofen', iodine: 'iodine (also contrast agents)', latex: 'latex' }
  },
  de: {
    speech: 'de-DE',
    phrases: {
      hello: 'Guten Tag', morning: 'Guten Morgen', evening: 'Guten Abend', bye: 'Auf Wiedersehen', please: 'Bitte', thanks: 'Danke', thanksMuch: 'Vielen Dank',
      yes: 'Ja', no: 'Nein', sorry: 'Entschuldigung', english: 'Sprechen Sie Englisch?', notUnderstand: 'Ich verstehe nicht.', price: 'Wie viel kostet das?', toilet: 'Wo ist die Toilette?',
      table: 'Einen Tisch für zwei, bitte.', menu: 'Die Speisekarte, bitte.', water: 'Ein Glas Wasser, bitte.', beer: 'Ein Bier, bitte.', coffee: 'Einen Kaffee, bitte.',
      bill: 'Die Rechnung, bitte.', card: 'Kann ich mit Karte zahlen?', vegetarian: 'Haben Sie etwas Vegetarisches?', delicious: 'Es war sehr lecker!',
      station: 'Wo ist der Bahnhof?', ticket: 'Eine Fahrkarte nach …, bitte.', open: 'Wann haben Sie geöffnet?', left: 'links', right: 'rechts', straight: 'geradeaus',
      help: 'Hilfe!', ambulance: 'Rufen Sie einen Krankenwagen!', doctor: 'Ich brauche einen Arzt.', hospital: 'Wo ist das Krankenhaus?', pharmacy: 'Wo ist eine Apotheke?',
      police: 'Rufen Sie die Polizei!', bloodThinner: 'Ich nehme Blutverdünner.', allergic: 'Ich habe eine Allergie gegen:', without: 'Bitte ohne diese Zutaten – das ist für mich gefährlich.',
      contains: 'Ist davon etwas enthalten?',
      diabetes: 'Ich habe Diabetes.', asthma: 'Ich habe Asthma.', pacemaker: 'Ich habe einen Herzschrittmacher.', bloodType: 'Blutgruppe:'
    },
    allergens: { peanuts: 'Erdnüsse', nuts: 'Schalenfrüchte (Nüsse)', gluten: 'Gluten', milk: 'Milch', eggs: 'Eier', fish: 'Fisch', shellfish: 'Meeresfrüchte', soy: 'Soja', sesame: 'Sesam', celery: 'Sellerie', mustard: 'Senf', penicillin: 'Penicillin', lactose: 'Laktose', molluscs: 'Weichtiere (Muscheln, Tintenfisch)', lupin: 'Lupinen', sulphites: 'Sulfite', kiwi: 'Kiwi', strawberries: 'Erdbeeren', tomatoes: 'Tomaten', peach: 'Pfirsich', garlic: 'Knoblauch', onions: 'Zwiebeln', corn: 'Mais', coconut: 'Kokosnuss', aspirin: 'Aspirin (Acetylsalicylsäure)', ibuprofen: 'Ibuprofen', iodine: 'Jod (auch Kontrastmittel)', latex: 'Latex' }
  },
  fr: {
    speech: 'fr-FR',
    phrases: {
      hello: 'Bonjour', morning: 'Bonjour', evening: 'Bonsoir', bye: 'Au revoir', please: 'S’il vous plaît', thanks: 'Merci', thanksMuch: 'Merci beaucoup',
      yes: 'Oui', no: 'Non', sorry: 'Excusez-moi', english: 'Parlez-vous anglais ?', notUnderstand: 'Je ne comprends pas.', price: 'Combien ça coûte ?', toilet: 'Où sont les toilettes ?',
      table: 'Une table pour deux, s’il vous plaît.', menu: 'La carte, s’il vous plaît.', water: 'Un verre d’eau, s’il vous plaît.', beer: 'Une bière, s’il vous plaît.', coffee: 'Un café, s’il vous plaît.',
      bill: 'L’addition, s’il vous plaît.', card: 'Je peux payer par carte ?', vegetarian: 'Vous avez quelque chose de végétarien ?', delicious: 'C’était délicieux !',
      station: 'Où est la gare ?', ticket: 'Un billet pour …, s’il vous plaît.', open: 'Quels sont vos horaires d’ouverture ?', left: 'à gauche', right: 'à droite', straight: 'tout droit',
      help: 'Au secours !', ambulance: 'Appelez une ambulance !', doctor: 'J’ai besoin d’un médecin.', hospital: 'Où est l’hôpital ?', pharmacy: 'Où y a-t-il une pharmacie ?',
      police: 'Appelez la police !', bloodThinner: 'Je prends des anticoagulants.', allergic: 'J’ai une allergie à :', without: 'Merci de préparer sans ces ingrédients – c’est dangereux pour moi.',
      contains: 'Est-ce que cela en contient ?',
      diabetes: 'J’ai du diabète.', asthma: 'J’ai de l’asthme.', pacemaker: 'J’ai un stimulateur cardiaque.', bloodType: 'Groupe sanguin :'
    },
    allergens: { peanuts: 'arachides', nuts: 'fruits à coque', gluten: 'gluten', milk: 'lait', eggs: 'œufs', fish: 'poisson', shellfish: 'fruits de mer', soy: 'soja', sesame: 'sésame', celery: 'céleri', mustard: 'moutarde', penicillin: 'pénicilline', lactose: 'lactose', molluscs: 'mollusques (moules, calamars)', lupin: 'lupin', sulphites: 'sulfites', kiwi: 'kiwi', strawberries: 'fraises', tomatoes: 'tomates', peach: 'pêche', garlic: 'ail', onions: 'oignons', corn: 'maïs', coconut: 'noix de coco', aspirin: 'aspirine', ibuprofen: 'ibuprofène', iodine: 'iode (aussi produits de contraste)', latex: 'latex' }
  },
  it: {
    speech: 'it-IT',
    phrases: {
      hello: 'Salve', morning: 'Buongiorno', evening: 'Buonasera', bye: 'Arrivederci', please: 'Per favore', thanks: 'Grazie', thanksMuch: 'Grazie mille',
      yes: 'Sì', no: 'No', sorry: 'Mi scusi', english: 'Parla inglese?', notUnderstand: 'Non capisco.', price: 'Quanto costa?', toilet: 'Dov’è il bagno?',
      table: 'Un tavolo per due, per favore.', menu: 'Il menù, per favore.', water: 'Un bicchiere d’acqua, per favore.', beer: 'Una birra, per favore.', coffee: 'Un caffè, per favore.',
      bill: 'Il conto, per favore.', card: 'Posso pagare con la carta?', vegetarian: 'Avete qualcosa di vegetariano?', delicious: 'Era buonissimo!',
      station: 'Dov’è la stazione?', ticket: 'Un biglietto per …, per favore.', open: 'Quando siete aperti?', left: 'a sinistra', right: 'a destra', straight: 'dritto',
      help: 'Aiuto!', ambulance: 'Chiami un’ambulanza!', doctor: 'Ho bisogno di un medico.', hospital: 'Dov’è l’ospedale?', pharmacy: 'Dov’è una farmacia?',
      police: 'Chiami la polizia!', bloodThinner: 'Prendo anticoagulanti.', allergic: 'Ho un’allergia a:', without: 'Per favore senza questi ingredienti – per me è pericoloso.',
      contains: 'Contiene qualcuno di questi?',
      diabetes: 'Ho il diabete.', asthma: 'Ho l’asma.', pacemaker: 'Ho un pacemaker.', bloodType: 'Gruppo sanguigno:'
    },
    allergens: { peanuts: 'arachidi', nuts: 'frutta a guscio', gluten: 'glutine', milk: 'latte', eggs: 'uova', fish: 'pesce', shellfish: 'frutti di mare', soy: 'soia', sesame: 'sesamo', celery: 'sedano', mustard: 'senape', penicillin: 'penicillina', lactose: 'lattosio', molluscs: 'molluschi (cozze, calamari)', lupin: 'lupini', sulphites: 'solfiti', kiwi: 'kiwi', strawberries: 'fragole', tomatoes: 'pomodori', peach: 'pesca', garlic: 'aglio', onions: 'cipolle', corn: 'mais', coconut: 'cocco', aspirin: 'aspirina', ibuprofen: 'ibuprofene', iodine: 'iodio (anche mezzi di contrasto)', latex: 'lattice' }
  },
  es: {
    speech: 'es-ES',
    phrases: {
      hello: 'Hola', morning: 'Buenos días', evening: 'Buenas noches', bye: 'Adiós', please: 'Por favor', thanks: 'Gracias', thanksMuch: 'Muchas gracias',
      yes: 'Sí', no: 'No', sorry: 'Perdone', english: '¿Habla inglés?', notUnderstand: 'No entiendo.', price: '¿Cuánto cuesta?', toilet: '¿Dónde está el baño?',
      table: 'Una mesa para dos, por favor.', menu: 'La carta, por favor.', water: 'Un vaso de agua, por favor.', beer: 'Una cerveza, por favor.', coffee: 'Un café, por favor.',
      bill: 'La cuenta, por favor.', card: '¿Puedo pagar con tarjeta?', vegetarian: '¿Tienen algo vegetariano?', delicious: '¡Estaba buenísimo!',
      station: '¿Dónde está la estación de tren?', ticket: 'Un billete a …, por favor.', open: '¿Cuándo abren?', left: 'a la izquierda', right: 'a la derecha', straight: 'todo recto',
      help: '¡Socorro!', ambulance: '¡Llame a una ambulancia!', doctor: 'Necesito un médico.', hospital: '¿Dónde está el hospital?', pharmacy: '¿Dónde hay una farmacia?',
      police: '¡Llame a la policía!', bloodThinner: 'Tomo anticoagulantes.', allergic: 'Tengo alergia a:', without: 'Por favor, sin estos ingredientes – es peligroso para mí.',
      contains: '¿Lleva alguno de estos?',
      diabetes: 'Tengo diabetes.', asthma: 'Tengo asma.', pacemaker: 'Llevo un marcapasos.', bloodType: 'Grupo sanguíneo:'
    },
    allergens: { peanuts: 'cacahuetes', nuts: 'frutos de cáscara', gluten: 'gluten', milk: 'leche', eggs: 'huevos', fish: 'pescado', shellfish: 'marisco', soy: 'soja', sesame: 'sésamo', celery: 'apio', mustard: 'mostaza', penicillin: 'penicilina', lactose: 'lactosa', molluscs: 'moluscos (mejillones, calamares)', lupin: 'altramuces', sulphites: 'sulfitos', kiwi: 'kiwi', strawberries: 'fresas', tomatoes: 'tomates', peach: 'melocotón', garlic: 'ajo', onions: 'cebolla', corn: 'maíz', coconut: 'coco', aspirin: 'aspirina', ibuprofen: 'ibuprofeno', iodine: 'yodo (también contrastes)', latex: 'látex' }
  },
  pt: {
    speech: 'pt-PT',
    phrases: {
      hello: 'Olá', morning: 'Bom dia', evening: 'Boa noite', bye: 'Até logo', please: 'Por favor', thanks: 'Obrigado / Obrigada', thanksMuch: 'Muito obrigado / obrigada',
      yes: 'Sim', no: 'Não', sorry: 'Desculpe', english: 'Fala inglês?', notUnderstand: 'Não entendo.', price: 'Quanto custa?', toilet: 'Onde fica a casa de banho?',
      table: 'Uma mesa para dois, por favor.', menu: 'O menu, por favor.', water: 'Um copo de água, por favor.', beer: 'Uma cerveja, por favor.', coffee: 'Um café, por favor.',
      bill: 'A conta, por favor.', card: 'Posso pagar com cartão?', vegetarian: 'Tem alguma coisa vegetariana?', delicious: 'Estava delicioso!',
      station: 'Onde fica a estação?', ticket: 'Um bilhete para …, por favor.', open: 'A que horas abrem?', left: 'à esquerda', right: 'à direita', straight: 'sempre em frente',
      help: 'Socorro!', ambulance: 'Chame uma ambulância!', doctor: 'Preciso de um médico.', hospital: 'Onde fica o hospital?', pharmacy: 'Onde há uma farmácia?',
      police: 'Chame a polícia!', bloodThinner: 'Tomo anticoagulantes.', allergic: 'Tenho alergia a:', without: 'Por favor, sem estes ingredientes – é perigoso para mim.',
      contains: 'Isto contém algum destes?',
      diabetes: 'Tenho diabetes.', asthma: 'Tenho asma.', pacemaker: 'Tenho um pacemaker.', bloodType: 'Grupo sanguíneo:'
    },
    allergens: { peanuts: 'amendoins', nuts: 'frutos de casca rija', gluten: 'glúten', milk: 'leite', eggs: 'ovos', fish: 'peixe', shellfish: 'marisco', soy: 'soja', sesame: 'sésamo', celery: 'aipo', mustard: 'mostarda', penicillin: 'penicilina', lactose: 'lactose', molluscs: 'moluscos (mexilhões, lulas)', lupin: 'tremoço', sulphites: 'sulfitos', kiwi: 'kiwi', strawberries: 'morangos', tomatoes: 'tomate', peach: 'pêssego', garlic: 'alho', onions: 'cebola', corn: 'milho', coconut: 'coco', aspirin: 'aspirina', ibuprofen: 'ibuprofeno', iodine: 'iodo (também contrastes)', latex: 'látex' }
  },
  nl: {
    speech: 'nl-NL',
    phrases: {
      hello: 'Hallo', morning: 'Goedemorgen', evening: 'Goedenavond', bye: 'Tot ziens', please: 'Alstublieft', thanks: 'Dank u', thanksMuch: 'Hartelijk dank',
      yes: 'Ja', no: 'Nee', sorry: 'Pardon', english: 'Spreekt u Engels?', notUnderstand: 'Ik begrijp het niet.', price: 'Hoeveel kost dit?', toilet: 'Waar is het toilet?',
      table: 'Een tafel voor twee, alstublieft.', menu: 'De menukaart, alstublieft.', water: 'Een glas water, alstublieft.', beer: 'Een biertje, alstublieft.', coffee: 'Een koffie, alstublieft.',
      bill: 'De rekening, alstublieft.', card: 'Kan ik met de kaart betalen?', vegetarian: 'Heeft u iets vegetarisch?', delicious: 'Het was heerlijk!',
      station: 'Waar is het station?', ticket: 'Een kaartje naar …, alstublieft.', open: 'Wanneer bent u open?', left: 'links', right: 'rechts', straight: 'rechtdoor',
      help: 'Help!', ambulance: 'Bel een ambulance!', doctor: 'Ik heb een dokter nodig.', hospital: 'Waar is het ziekenhuis?', pharmacy: 'Waar is een apotheek?',
      police: 'Bel de politie!', bloodThinner: 'Ik gebruik bloedverdunners.', allergic: 'Ik ben allergisch voor:', without: 'Graag zonder deze ingrediënten – dat is gevaarlijk voor mij.',
      contains: 'Zit hier een van deze in?',
      diabetes: 'Ik heb diabetes.', asthma: 'Ik heb astma.', pacemaker: 'Ik heb een pacemaker.', bloodType: 'Bloedgroep:'
    },
    allergens: { peanuts: 'pinda’s', nuts: 'noten', gluten: 'gluten', milk: 'melk', eggs: 'eieren', fish: 'vis', shellfish: 'schaaldieren', soy: 'soja', sesame: 'sesam', celery: 'selderij', mustard: 'mosterd', penicillin: 'penicilline', lactose: 'lactose', molluscs: 'weekdieren (mosselen, inktvis)', lupin: 'lupine', sulphites: 'sulfiet', kiwi: 'kiwi', strawberries: 'aardbeien', tomatoes: 'tomaten', peach: 'perzik', garlic: 'knoflook', onions: 'uien', corn: 'maïs', coconut: 'kokosnoot', aspirin: 'aspirine', ibuprofen: 'ibuprofen', iodine: 'jodium (ook contrastmiddel)', latex: 'latex' }
  },
  da: {
    speech: 'da-DK',
    phrases: {
      hello: 'Hej', morning: 'Godmorgen', evening: 'Godaften', bye: 'Farvel', please: 'Vær så venlig', thanks: 'Tak', thanksMuch: 'Mange tak',
      yes: 'Ja', no: 'Nej', sorry: 'Undskyld', english: 'Taler du engelsk?', notUnderstand: 'Jeg forstår ikke.', price: 'Hvad koster det?', toilet: 'Hvor er toilettet?',
      table: 'Et bord til to, tak.', menu: 'Menukortet, tak.', water: 'Et glas vand, tak.', beer: 'En øl, tak.', coffee: 'En kop kaffe, tak.',
      bill: 'Regningen, tak.', card: 'Kan jeg betale med kort?', vegetarian: 'Har I noget vegetarisk?', delicious: 'Det smagte dejligt!',
      station: 'Hvor er stationen?', ticket: 'En billet til …, tak.', open: 'Hvornår har I åbent?', left: 'til venstre', right: 'til højre', straight: 'ligeud',
      help: 'Hjælp!', ambulance: 'Ring efter en ambulance!', doctor: 'Jeg har brug for en læge.', hospital: 'Hvor er hospitalet?', pharmacy: 'Hvor er der et apotek?',
      police: 'Ring til politiet!', bloodThinner: 'Jeg tager blodfortyndende medicin.', allergic: 'Jeg er allergisk over for:', without: 'Uden disse ingredienser, tak – det er farligt for mig.',
      contains: 'Er der noget af dette i?',
      diabetes: 'Jeg har diabetes.', asthma: 'Jeg har astma.', pacemaker: 'Jeg har en pacemaker.', bloodType: 'Blodtype:'
    },
    allergens: { peanuts: 'jordnødder', nuts: 'nødder', gluten: 'gluten', milk: 'mælk', eggs: 'æg', fish: 'fisk', shellfish: 'skaldyr', soy: 'soja', sesame: 'sesam', celery: 'selleri', mustard: 'sennep', penicillin: 'penicillin', lactose: 'laktose', molluscs: 'bløddyr (muslinger, blæksprutte)', lupin: 'lupin', sulphites: 'sulfitter', kiwi: 'kiwi', strawberries: 'jordbær', tomatoes: 'tomater', peach: 'fersken', garlic: 'hvidløg', onions: 'løg', corn: 'majs', coconut: 'kokos', aspirin: 'aspirin', ibuprofen: 'ibuprofen', iodine: 'jod (også kontrastmiddel)', latex: 'latex' }
  },
  sv: {
    speech: 'sv-SE',
    phrases: {
      hello: 'Hej', morning: 'God morgon', evening: 'God kväll', bye: 'Hej då', please: 'Snälla', thanks: 'Tack', thanksMuch: 'Tack så mycket',
      yes: 'Ja', no: 'Nej', sorry: 'Ursäkta', english: 'Talar du engelska?', notUnderstand: 'Jag förstår inte.', price: 'Vad kostar det?', toilet: 'Var är toaletten?',
      table: 'Ett bord för två, tack.', menu: 'Menyn, tack.', water: 'Ett glas vatten, tack.', beer: 'En öl, tack.', coffee: 'En kaffe, tack.',
      bill: 'Notan, tack.', card: 'Kan jag betala med kort?', vegetarian: 'Har ni något vegetariskt?', delicious: 'Det var jättegott!',
      station: 'Var ligger stationen?', ticket: 'En biljett till …, tack.', open: 'När har ni öppet?', left: 'till vänster', right: 'till höger', straight: 'rakt fram',
      help: 'Hjälp!', ambulance: 'Ring efter en ambulans!', doctor: 'Jag behöver en läkare.', hospital: 'Var ligger sjukhuset?', pharmacy: 'Var finns ett apotek?',
      police: 'Ring polisen!', bloodThinner: 'Jag tar blodförtunnande medicin.', allergic: 'Jag är allergisk mot:', without: 'Utan dessa ingredienser, tack – det är farligt för mig.',
      contains: 'Innehåller det här något av detta?',
      diabetes: 'Jag har diabetes.', asthma: 'Jag har astma.', pacemaker: 'Jag har en pacemaker.', bloodType: 'Blodgrupp:'
    },
    allergens: { peanuts: 'jordnötter', nuts: 'nötter', gluten: 'gluten', milk: 'mjölk', eggs: 'ägg', fish: 'fisk', shellfish: 'skaldjur', soy: 'soja', sesame: 'sesam', celery: 'selleri', mustard: 'senap', penicillin: 'penicillin', lactose: 'laktos', molluscs: 'blötdjur (musslor, bläckfisk)', lupin: 'lupin', sulphites: 'sulfiter', kiwi: 'kiwi', strawberries: 'jordgubbar', tomatoes: 'tomater', peach: 'persika', garlic: 'vitlök', onions: 'lök', corn: 'majs', coconut: 'kokos', aspirin: 'acetylsalicylsyra (Aspirin)', ibuprofen: 'ibuprofen', iodine: 'jod (även kontrastmedel)', latex: 'latex' }
  },
  no: {
    speech: 'nb-NO',
    phrases: {
      hello: 'Hei', morning: 'God morgen', evening: 'God kveld', bye: 'Ha det bra', please: 'Vær så snill', thanks: 'Takk', thanksMuch: 'Tusen takk',
      yes: 'Ja', no: 'Nei', sorry: 'Unnskyld', english: 'Snakker du engelsk?', notUnderstand: 'Jeg forstår ikke.', price: 'Hva koster det?', toilet: 'Hvor er toalettet?',
      table: 'Et bord til to, takk.', menu: 'Menyen, takk.', water: 'Et glass vann, takk.', beer: 'En øl, takk.', coffee: 'En kaffe, takk.',
      bill: 'Regningen, takk.', card: 'Kan jeg betale med kort?', vegetarian: 'Har dere noe vegetarisk?', delicious: 'Det smakte veldig godt!',
      station: 'Hvor er stasjonen?', ticket: 'En billett til …, takk.', open: 'Når har dere åpent?', left: 'til venstre', right: 'til høyre', straight: 'rett fram',
      help: 'Hjelp!', ambulance: 'Ring etter ambulanse!', doctor: 'Jeg trenger en lege.', hospital: 'Hvor er sykehuset?', pharmacy: 'Hvor er det et apotek?',
      police: 'Ring politiet!', bloodThinner: 'Jeg bruker blodfortynnende medisin.', allergic: 'Jeg er allergisk mot:', without: 'Uten disse ingrediensene, takk – det er farlig for meg.',
      contains: 'Inneholder dette noe av dette?',
      diabetes: 'Jeg har diabetes.', asthma: 'Jeg har astma.', pacemaker: 'Jeg har pacemaker.', bloodType: 'Blodtype:'
    },
    allergens: { peanuts: 'peanøtter', nuts: 'nøtter', gluten: 'gluten', milk: 'melk', eggs: 'egg', fish: 'fisk', shellfish: 'skalldyr', soy: 'soya', sesame: 'sesam', celery: 'selleri', mustard: 'sennep', penicillin: 'penicillin', lactose: 'laktose', molluscs: 'bløtdyr (blåskjell, blekksprut)', lupin: 'lupin', sulphites: 'sulfitter', kiwi: 'kiwi', strawberries: 'jordbær', tomatoes: 'tomater', peach: 'fersken', garlic: 'hvitløk', onions: 'løk', corn: 'mais', coconut: 'kokos', aspirin: 'acetylsalisylsyre (Aspirin)', ibuprofen: 'ibuprofen', iodine: 'jod (også kontrastmiddel)', latex: 'lateks' }
  },
  pl: {
    speech: 'pl-PL',
    phrases: {
      hello: 'Dzień dobry', morning: 'Dzień dobry', evening: 'Dobry wieczór', bye: 'Do widzenia', please: 'Proszę', thanks: 'Dziękuję', thanksMuch: 'Dziękuję bardzo',
      yes: 'Tak', no: 'Nie', sorry: 'Przepraszam', english: 'Czy mówi pan / pani po angielsku?', notUnderstand: 'Nie rozumiem.', price: 'Ile to kosztuje?', toilet: 'Gdzie jest toaleta?',
      table: 'Stolik dla dwóch osób, proszę.', menu: 'Poproszę menu.', water: 'Poproszę szklankę wody.', beer: 'Poproszę piwo.', coffee: 'Poproszę kawę.',
      bill: 'Poproszę rachunek.', card: 'Czy mogę zapłacić kartą?', vegetarian: 'Czy mają Państwo coś wegetariańskiego?', delicious: 'Było pyszne!',
      station: 'Gdzie jest dworzec?', ticket: 'Poproszę bilet do …', open: 'W jakich godzinach jest otwarte?', left: 'w lewo', right: 'w prawo', straight: 'prosto',
      help: 'Pomocy!', ambulance: 'Proszę wezwać karetkę!', doctor: 'Potrzebuję lekarza.', hospital: 'Gdzie jest szpital?', pharmacy: 'Gdzie jest apteka?',
      police: 'Proszę wezwać policję!', bloodThinner: 'Biorę leki przeciwzakrzepowe.', allergic: 'Mam alergię na:', without: 'Proszę bez tych składników – to dla mnie niebezpieczne.',
      contains: 'Czy to zawiera któryś z tych składników?',
      diabetes: 'Mam cukrzycę.', asthma: 'Mam astmę.', pacemaker: 'Mam rozrusznik serca.', bloodType: 'Grupa krwi:'
    },
    allergens: { peanuts: 'orzeszki ziemne', nuts: 'orzechy', gluten: 'gluten', milk: 'mleko', eggs: 'jajka', fish: 'ryby', shellfish: 'owoce morza', soy: 'soja', sesame: 'sezam', celery: 'seler', mustard: 'gorczyca', penicillin: 'penicylina', lactose: 'laktoza', molluscs: 'mięczaki (małże, kalmary)', lupin: 'łubin', sulphites: 'siarczyny', kiwi: 'kiwi', strawberries: 'truskawki', tomatoes: 'pomidory', peach: 'brzoskwinie', garlic: 'czosnek', onions: 'cebula', corn: 'kukurydza', coconut: 'kokos', aspirin: 'aspiryna', ibuprofen: 'ibuprofen', iodine: 'jod (także środki kontrastowe)', latex: 'lateks' }
  },
  cs: {
    speech: 'cs-CZ',
    phrases: {
      hello: 'Dobrý den', morning: 'Dobré ráno', evening: 'Dobrý večer', bye: 'Na shledanou', please: 'Prosím', thanks: 'Děkuji', thanksMuch: 'Děkuji mnohokrát',
      yes: 'Ano', no: 'Ne', sorry: 'Promiňte', english: 'Mluvíte anglicky?', notUnderstand: 'Nerozumím.', price: 'Kolik to stojí?', toilet: 'Kde je toaleta?',
      table: 'Stůl pro dva, prosím.', menu: 'Jídelní lístek, prosím.', water: 'Sklenici vody, prosím.', beer: 'Jedno pivo, prosím.', coffee: 'Kávu, prosím.',
      bill: 'Zaplatím, prosím.', card: 'Můžu platit kartou?', vegetarian: 'Máte něco vegetariánského?', delicious: 'Bylo to výborné!',
      station: 'Kde je nádraží?', ticket: 'Jízdenku do …, prosím.', open: 'Kdy máte otevřeno?', left: 'vlevo', right: 'vpravo', straight: 'rovně',
      help: 'Pomoc!', ambulance: 'Zavolejte sanitku!', doctor: 'Potřebuji lékaře.', hospital: 'Kde je nemocnice?', pharmacy: 'Kde je lékárna?',
      police: 'Zavolejte policii!', bloodThinner: 'Beru léky na ředění krve.', allergic: 'Mám alergii na:', without: 'Prosím bez těchto surovin – je to pro mě nebezpečné.',
      contains: 'Obsahuje to něco z tohoto?',
      diabetes: 'Mám cukrovku.', asthma: 'Mám astma.', pacemaker: 'Mám kardiostimulátor.', bloodType: 'Krevní skupina:'
    },
    allergens: { peanuts: 'arašídy', nuts: 'ořechy', gluten: 'lepek', milk: 'mléko', eggs: 'vejce', fish: 'ryby', shellfish: 'mořské plody', soy: 'sója', sesame: 'sezam', celery: 'celer', mustard: 'hořčice', penicillin: 'penicilin', lactose: 'laktóza', molluscs: 'měkkýši (mušle, chobotnice)', lupin: 'vlčí bob (lupina)', sulphites: 'siřičitany', kiwi: 'kiwi', strawberries: 'jahody', tomatoes: 'rajčata', peach: 'broskve', garlic: 'česnek', onions: 'cibule', corn: 'kukuřice', coconut: 'kokos', aspirin: 'aspirin (kyselina acetylsalicylová)', ibuprofen: 'ibuprofen', iodine: 'jód (i kontrastní látky)', latex: 'latex' }
  },
  hu: {
    speech: 'hu-HU',
    phrases: {
      hello: 'Jó napot kívánok', morning: 'Jó reggelt', evening: 'Jó estét', bye: 'Viszontlátásra', please: 'Kérem', thanks: 'Köszönöm', thanksMuch: 'Köszönöm szépen',
      yes: 'Igen', no: 'Nem', sorry: 'Elnézést', english: 'Beszél angolul?', notUnderstand: 'Nem értem.', price: 'Mennyibe kerül?', toilet: 'Hol van a mosdó?',
      table: 'Egy asztalt kérek két főre.', menu: 'Az étlapot kérem.', water: 'Egy pohár vizet kérek.', beer: 'Egy sört kérek.', coffee: 'Egy kávét kérek.',
      bill: 'A számlát kérem.', card: 'Fizethetek kártyával?', vegetarian: 'Van valami vegetáriánus ételük?', delicious: 'Nagyon finom volt!',
      station: 'Hol van a vasútállomás?', ticket: 'Egy jegyet kérek ide: …', open: 'Mikor vannak nyitva?', left: 'balra', right: 'jobbra', straight: 'egyenesen',
      help: 'Segítség!', ambulance: 'Hívjon mentőt!', doctor: 'Orvosra van szükségem.', hospital: 'Hol van a kórház?', pharmacy: 'Hol van egy gyógyszertár?',
      police: 'Hívja a rendőrséget!', bloodThinner: 'Véralvadásgátlót szedek.', allergic: 'Allergiás vagyok a következőkre:', without: 'Kérem, ezek nélkül – számomra veszélyes.',
      contains: 'Tartalmaz ezek közül valamit?',
      diabetes: 'Cukorbeteg vagyok.', asthma: 'Asztmás vagyok.', pacemaker: 'Szívritmus-szabályozóm van.', bloodType: 'Vércsoport:'
    },
    allergens: { peanuts: 'földimogyoró', nuts: 'diófélék', gluten: 'glutén', milk: 'tej', eggs: 'tojás', fish: 'hal', shellfish: 'tenger gyümölcsei', soy: 'szója', sesame: 'szezám', celery: 'zeller', mustard: 'mustár', penicillin: 'penicillin', lactose: 'laktóz', molluscs: 'puhatestűek (kagyló, tintahal)', lupin: 'csillagfürt', sulphites: 'szulfitok', kiwi: 'kivi', strawberries: 'eper', tomatoes: 'paradicsom', peach: 'őszibarack', garlic: 'fokhagyma', onions: 'hagyma', corn: 'kukorica', coconut: 'kókusz', aspirin: 'aszpirin', ibuprofen: 'ibuprofén', iodine: 'jód (kontrasztanyag is)', latex: 'latex' }
  },
  hr: {
    speech: 'hr-HR',
    phrases: {
      hello: 'Dobar dan', morning: 'Dobro jutro', evening: 'Dobra večer', bye: 'Doviđenja', please: 'Molim', thanks: 'Hvala', thanksMuch: 'Hvala lijepa',
      yes: 'Da', no: 'Ne', sorry: 'Oprostite', english: 'Govorite li engleski?', notUnderstand: 'Ne razumijem.', price: 'Koliko to košta?', toilet: 'Gdje je WC?',
      table: 'Stol za dvoje, molim.', menu: 'Jelovnik, molim.', water: 'Čašu vode, molim.', beer: 'Jedno pivo, molim.', coffee: 'Kavu, molim.',
      bill: 'Račun, molim.', card: 'Mogu li platiti karticom?', vegetarian: 'Imate li nešto vegetarijansko?', delicious: 'Bilo je jako ukusno!',
      station: 'Gdje je kolodvor?', ticket: 'Kartu do …, molim.', open: 'Kada radite?', left: 'lijevo', right: 'desno', straight: 'ravno',
      help: 'Upomoć!', ambulance: 'Zovite hitnu pomoć!', doctor: 'Trebam liječnika.', hospital: 'Gdje je bolnica?', pharmacy: 'Gdje je ljekarna?',
      police: 'Zovite policiju!', bloodThinner: 'Uzimam lijekove za razrjeđivanje krvi.', allergic: 'Imam alergiju na:', without: 'Molim bez ovih sastojaka – to je za mene opasno.',
      contains: 'Sadrži li ovo nešto od toga?',
      diabetes: 'Imam dijabetes.', asthma: 'Imam astmu.', pacemaker: 'Imam srčani elektrostimulator (pacemaker).', bloodType: 'Krvna grupa:'
    },
    allergens: { peanuts: 'kikiriki', nuts: 'orašasti plodovi', gluten: 'gluten', milk: 'mlijeko', eggs: 'jaja', fish: 'riba', shellfish: 'plodovi mora', soy: 'soja', sesame: 'sezam', celery: 'celer', mustard: 'senf', penicillin: 'penicilin', lactose: 'laktoza', molluscs: 'mekušci (dagnje, lignje)', lupin: 'lupina', sulphites: 'sulfiti', kiwi: 'kivi', strawberries: 'jagode', tomatoes: 'rajčica', peach: 'breskva', garlic: 'češnjak', onions: 'luk', corn: 'kukuruz', coconut: 'kokos', aspirin: 'aspirin', ibuprofen: 'ibuprofen', iodine: 'jod (i kontrastna sredstva)', latex: 'lateks' }
  },
  sl: {
    speech: 'sl-SI',
    phrases: {
      hello: 'Dober dan', morning: 'Dobro jutro', evening: 'Dober večer', bye: 'Nasvidenje', please: 'Prosim', thanks: 'Hvala', thanksMuch: 'Najlepša hvala',
      yes: 'Da', no: 'Ne', sorry: 'Oprostite', english: 'Govorite angleško?', notUnderstand: 'Ne razumem.', price: 'Koliko stane?', toilet: 'Kje je stranišče?',
      table: 'Mizo za dva, prosim.', menu: 'Jedilni list, prosim.', water: 'Kozarec vode, prosim.', beer: 'Eno pivo, prosim.', coffee: 'Kavo, prosim.',
      bill: 'Račun, prosim.', card: 'Lahko plačam s kartico?', vegetarian: 'Imate kaj vegetarijanskega?', delicious: 'Bilo je zelo okusno!',
      station: 'Kje je železniška postaja?', ticket: 'Vozovnico do …, prosim.', open: 'Kdaj imate odprto?', left: 'levo', right: 'desno', straight: 'naravnost',
      help: 'Na pomoč!', ambulance: 'Pokličite rešilca!', doctor: 'Potrebujem zdravnika.', hospital: 'Kje je bolnišnica?', pharmacy: 'Kje je lekarna?',
      police: 'Pokličite policijo!', bloodThinner: 'Jemljem zdravila za redčenje krvi.', allergic: 'Imam alergijo na:', without: 'Prosim brez teh sestavin – zame je nevarno.',
      contains: 'Ali to vsebuje kaj od tega?',
      diabetes: 'Imam sladkorno bolezen.', asthma: 'Imam astmo.', pacemaker: 'Imam srčni spodbujevalnik.', bloodType: 'Krvna skupina:'
    },
    allergens: { peanuts: 'arašidi', nuts: 'oreščki', gluten: 'gluten', milk: 'mleko', eggs: 'jajca', fish: 'ribe', shellfish: 'morski sadeži', soy: 'soja', sesame: 'sezam', celery: 'zelena', mustard: 'gorčica', penicillin: 'penicilin', lactose: 'laktoza', molluscs: 'mehkužci (školjke, lignji)', lupin: 'volčji bob', sulphites: 'sulfiti', kiwi: 'kivi', strawberries: 'jagode', tomatoes: 'paradižnik', peach: 'breskev', garlic: 'česen', onions: 'čebula', corn: 'koruza', coconut: 'kokos', aspirin: 'aspirin', ibuprofen: 'ibuprofen', iodine: 'jod (tudi kontrastna sredstva)', latex: 'lateks' }
  },
  el: {
    speech: 'el-GR',
    phrases: {
      hello: 'Γεια σας', morning: 'Καλημέρα', evening: 'Καλησπέρα', bye: 'Αντίο σας', please: 'Παρακαλώ', thanks: 'Ευχαριστώ', thanksMuch: 'Ευχαριστώ πολύ',
      yes: 'Ναι', no: 'Όχι', sorry: 'Συγγνώμη', english: 'Μιλάτε αγγλικά;', notUnderstand: 'Δεν καταλαβαίνω.', price: 'Πόσο κάνει;', toilet: 'Πού είναι η τουαλέτα;',
      table: 'Ένα τραπέζι για δύο, παρακαλώ.', menu: 'Τον κατάλογο, παρακαλώ.', water: 'Ένα ποτήρι νερό, παρακαλώ.', beer: 'Μία μπίρα, παρακαλώ.', coffee: 'Έναν καφέ, παρακαλώ.',
      bill: 'Τον λογαριασμό, παρακαλώ.', card: 'Μπορώ να πληρώσω με κάρτα;', vegetarian: 'Έχετε κάτι χορτοφαγικό;', delicious: 'Ήταν πολύ νόστιμο!',
      station: 'Πού είναι ο σταθμός;', ticket: 'Ένα εισιτήριο για …, παρακαλώ.', open: 'Τι ώρα ανοίγετε;', left: 'αριστερά', right: 'δεξιά', straight: 'ευθεία',
      help: 'Βοήθεια!', ambulance: 'Καλέστε ασθενοφόρο!', doctor: 'Χρειάζομαι γιατρό.', hospital: 'Πού είναι το νοσοκομείο;', pharmacy: 'Πού υπάρχει φαρμακείο;',
      police: 'Καλέστε την αστυνομία!', bloodThinner: 'Παίρνω αντιπηκτικά.', allergic: 'Έχω αλλεργία σε:', without: 'Χωρίς αυτά τα υλικά, παρακαλώ – είναι επικίνδυνο για μένα.',
      contains: 'Περιέχει κάποιο από αυτά;',
      diabetes: 'Έχω διαβήτη.', asthma: 'Έχω άσθμα.', pacemaker: 'Έχω βηματοδότη.', bloodType: 'Ομάδα αίματος:'
    },
    allergens: { peanuts: 'αράπικα φιστίκια', nuts: 'ξηροί καρποί', gluten: 'γλουτένη', milk: 'γάλα', eggs: 'αυγά', fish: 'ψάρι', shellfish: 'θαλασσινά', soy: 'σόγια', sesame: 'σουσάμι', celery: 'σέλινο', mustard: 'μουστάρδα', penicillin: 'πενικιλίνη', lactose: 'λακτόζη', molluscs: 'μαλάκια (μύδια, καλαμάρια)', lupin: 'λούπινο', sulphites: 'θειώδη', kiwi: 'ακτινίδιο', strawberries: 'φράουλες', tomatoes: 'ντομάτες', peach: 'ροδάκινο', garlic: 'σκόρδο', onions: 'κρεμμύδι', corn: 'καλαμπόκι', coconut: 'καρύδα', aspirin: 'ασπιρίνη', ibuprofen: 'ιβουπροφαίνη', iodine: 'ιώδιο (και σκιαγραφικά)', latex: 'λάτεξ' },
    pron: {
      phrases: {
        hello: 'Ja sas', morning: 'Kaliméra', evening: 'Kalispéra', bye: 'Adío sas', please: 'Parakaló', thanks: 'Efcharistó', thanksMuch: 'Efcharistó polí',
        yes: 'Ne', no: 'Óchi', sorry: 'Signómi', english: 'Miláte angliká?', notUnderstand: 'Den katalawéno.', price: 'Póso káni?', toilet: 'Pu íne i tualéta?',
        table: 'Éna trapési ja dío, parakaló.', menu: 'Ton katálogo, parakaló.', water: 'Éna potíri neró, parakaló.', beer: 'Mía bíra, parakaló.', coffee: 'Énan kafé, parakaló.',
        bill: 'Ton logariasmó, parakaló.', card: 'Boró na pliróso me kárta?', vegetarian: 'Échete káti chortofagikó?', delicious: 'Ítan polí nóstimo!',
        station: 'Pu íne o stathmós?', ticket: 'Éna issitírio ja …, parakaló.', open: 'Ti óra anígete?', left: 'aristerá', right: 'dexiá', straight: 'efthía',
        help: 'Woíthia!', ambulance: 'Kaléste asthenofóro!', doctor: 'Chriásome jatró.', hospital: 'Pu íne to nosokomío?', pharmacy: 'Pu ipárchi farmakío?',
        police: 'Kaléste tin astinomía!', bloodThinner: 'Pérno antipiktiká.', allergic: 'Écho alerjía se:', without: 'Chorís aftá ta iliká, parakaló – íne epikíndino ja ména.',
        contains: 'Periéchi kápio apó aftá?',
        diabetes: 'Écho diavíti.', asthma: 'Écho ásthma.', pacemaker: 'Écho vimatodóti.', bloodType: 'Omáda ématos:'
      },
      allergens: { peanuts: 'arápika fistíkia', nuts: 'xirí karpí', gluten: 'gluténi', milk: 'gála', eggs: 'awgá', fish: 'psári', shellfish: 'thalassiná', soy: 'sója', sesame: 'susámi', celery: 'sélino', mustard: 'mustárda', penicillin: 'penikilíni', lactose: 'laktósi', molluscs: 'malákia (mídia, kalamária)', lupin: 'lúpino', sulphites: 'thiódi', kiwi: 'aktinídio', strawberries: 'fráules', tomatoes: 'domátes', peach: 'rodákino', garlic: 'skórdo', onions: 'kremídi', corn: 'kalambóki', coconut: 'karída', aspirin: 'aspiríni', ibuprofen: 'ivuprofaíni', iodine: 'iódio (ke skiagrafiká)', latex: 'látex' }
    }
  },
  tr: {
    speech: 'tr-TR',
    phrases: {
      hello: 'Merhaba', morning: 'Günaydın', evening: 'İyi akşamlar', bye: 'Hoşça kalın', please: 'Lütfen', thanks: 'Teşekkür ederim', thanksMuch: 'Çok teşekkür ederim',
      yes: 'Evet', no: 'Hayır', sorry: 'Affedersiniz', english: 'İngilizce biliyor musunuz?', notUnderstand: 'Anlamıyorum.', price: 'Bu ne kadar?', toilet: 'Tuvalet nerede?',
      table: 'İki kişilik bir masa, lütfen.', menu: 'Menü, lütfen.', water: 'Bir bardak su, lütfen.', beer: 'Bir bira, lütfen.', coffee: 'Bir kahve, lütfen.',
      bill: 'Hesap, lütfen.', card: 'Kartla ödeyebilir miyim?', vegetarian: 'Vejetaryen bir şeyiniz var mı?', delicious: 'Çok lezzetliydi!',
      station: 'Tren istasyonu nerede?', ticket: '… için bir bilet, lütfen.', open: 'Ne zaman açıksınız?', left: 'sola', right: 'sağa', straight: 'düz',
      help: 'İmdat!', ambulance: 'Ambulans çağırın!', doctor: 'Doktora ihtiyacım var.', hospital: 'Hastane nerede?', pharmacy: 'Eczane nerede?',
      police: 'Polis çağırın!', bloodThinner: 'Kan sulandırıcı ilaç kullanıyorum.', allergic: 'Şunlara alerjim var:', without: 'Lütfen bunlar olmadan – benim için tehlikeli.',
      contains: 'Bunlardan herhangi birini içeriyor mu?',
      diabetes: 'Şeker hastasıyım.', asthma: 'Astımım var.', pacemaker: 'Kalp pilim var.', bloodType: 'Kan grubu:'
    },
    allergens: { peanuts: 'yer fıstığı', nuts: 'kabuklu yemişler', gluten: 'gluten', milk: 'süt', eggs: 'yumurta', fish: 'balık', shellfish: 'deniz ürünleri', soy: 'soya', sesame: 'susam', celery: 'kereviz', mustard: 'hardal', penicillin: 'penisilin', lactose: 'laktoz', molluscs: 'yumuşakçalar (midye, kalamar)', lupin: 'acı bakla (lupin)', sulphites: 'sülfitler', kiwi: 'kivi', strawberries: 'çilek', tomatoes: 'domates', peach: 'şeftali', garlic: 'sarımsak', onions: 'soğan', corn: 'mısır', coconut: 'hindistan cevizi', aspirin: 'aspirin', ibuprofen: 'ibuprofen', iodine: 'iyot (kontrast madde dahil)', latex: 'lateks' }
  }
}
