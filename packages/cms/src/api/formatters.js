module.exports = function(app) {

  const {db} = app.settings;

  app.get("/api/formatters", (req, res) => {

    db.formatter.findAll()
      .then(results => {
        res.json(results).end();
      });
  });

};