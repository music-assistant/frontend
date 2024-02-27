describe('My first test', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('Opens the app', () => {
    cy.get('#app').should('have.length', 1);
  });
});
